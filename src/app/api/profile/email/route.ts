import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import { safeReturnOrigin } from "@/lib/security/identity";
import {
  escapeEmailHtml,
  isCustomMailerConfigured,
  sendPortalEmail,
} from "@/lib/security/mailer";
import {
  AuthThrottleError,
  clearAuthThrottle,
  clientIp,
  consumeAuthThrottle,
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    newEmail: z.email("Masukkan alamat email yang valid (contoh: nama@gmail.com).").max(150),
  }),
  z.object({
    action: z.literal("verify"),
    newEmail: z.email("Masukkan alamat email yang valid (contoh: nama@gmail.com).").max(150),
    token: z.string().trim().regex(/^[0-9]{6,10}$/, "Kode OTP harus 6–10 digit angka."),
  }),
]);

export async function POST(req: Request) {
  try {
    const { db, user, profile } = await apiSession();
    const body = schema.parse(await boundedJson(req, 4000));
    const newEmail = body.newEmail.trim().toLowerCase();
    const currentEmail = profile.email.trim().toLowerCase();
    const ip = clientIp(req);
    const admin = adminClient();

    if (newEmail === currentEmail) {
      throw new Error("Alamat email baru sama dengan email yang sudah terdaftar.");
    }

    const { data: conflict } = await admin
      .from("profiles")
      .select("id")
      .eq("email", newEmail)
      .neq("id", profile.id)
      .limit(1);
    if (conflict?.length) {
      throw new Error("Email tersebut sudah digunakan oleh akun lain.");
    }

    if (body.action === "request") {
      await consumeAuthThrottle(admin, [
        `email-change-req:${profile.id}`,
        `email-change-ip:${ip}`,
      ]);
      const origin = safeReturnOrigin(req);

      if (isCustomMailerConfigured() && user.email) {
        const generated = await admin.auth.admin.generateLink({
          type: "email_change_new",
          email: user.email,
          newEmail,
          options: { redirectTo: `${origin}/auth/confirm` },
        });
        const otp = generated.data?.properties?.email_otp;
        if (!generated.error && otp) {
          const result = await sendPortalEmail({
            to: newEmail,
            subject: "Kode OTP Verifikasi Email — NEXUS OBE",
            text: `Halo ${profile.full_name},\n\nGunakan kode OTP berikut untuk memverifikasi alamat email baru akun NEXUS OBE Anda:\n\nKode OTP: ${otp}\n\nJangan bagikan kode ini kepada siapa pun.`,
            html: `
              <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;color:#19253a">
                <div style="display:inline-block;background:#8b0000;color:#ffffff;font-weight:800;font-size:12px;letter-spacing:.08em;padding:6px 12px;border-radius:999px;margin-bottom:16px">NEXUS OBE · VERIFIKASI EMAIL</div>
                <h2 style="margin:0 0 8px;font-size:20px">Verifikasi Email Akun Anda</h2>
                <p style="margin:0 0 16px;color:#475569;font-size:14px">Halo <strong>${escapeEmailHtml(profile.full_name)}</strong>, masukkan kode OTP berikut di menu Pengaturan:</p>
                <div style="background:#fff4f4;border:1px solid #f3c4c4;border-radius:12px;padding:18px;text-align:center;margin:20px 0">
                  <div style="font-size:32px;font-weight:900;letter-spacing:.28em;color:#67060c;font-family:monospace">${escapeEmailHtml(otp)}</div>
                </div>
                <p style="margin:0;font-size:12px;color:#64748b">Jangan berikan kode ini kepada siapa pun.</p>
              </div>
            `,
          });
          if (result.sent) {
            return NextResponse.json({
              ok: true,
              message: `Kode OTP 6 digit telah dikirim ke ${newEmail}. Periksa kotak masuk atau folder spam.`,
            });
          }
        }
      }

      const { error } = await db.auth.updateUser({ email: newEmail });
      if (error) {
        if (error.message.toLowerCase().includes("rate")) {
          return apiError(new Error("Tunggu 60 detik sebelum meminta kode OTP baru."), 429);
        }
        throw new Error(error.message);
      }

      return NextResponse.json({
        ok: true,
        message: `Kode OTP verifikasi dikirim ke ${newEmail}. Periksa kotak masuk atau folder spam.`,
      });
    }

    const hashes = await consumeAuthThrottle(admin, [
      `email-change-ver:${profile.id}`,
      `email-change-ip:${ip}`,
    ]);

    const { data: verified, error: verifyErr } = await db.auth.verifyOtp({
      email: newEmail,
      token: body.token.trim(),
      type: "email_change",
    });
    if (verifyErr) {
      return apiError(new Error("Kode OTP salah atau sudah kedaluwarsa."), 401);
    }

    if (verified.user?.email?.trim().toLowerCase() !== newEmail) {
      const finalized = await admin.auth.admin.updateUserById(profile.id, {
        email: newEmail,
        email_confirm: true,
      });
      if (finalized.error) throw new Error(finalized.error.message);
    }

    await admin
      .from("account_allowlist")
      .upsert({ email: newEmail }, { onConflict: "email" });
    const { error: profErr } = await admin
      .from("profiles")
      .update({ email: newEmail, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (profErr) throw new Error(profErr.message);

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "EMAIL_UPDATED",
      target_table: "profiles",
      target_id: profile.id,
      metadata: { old_email: currentEmail, new_email: newEmail },
      ip_address: ip,
    });

    await clearAuthThrottle(admin, hashes);
    return NextResponse.json({ ok: true, email: newEmail });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}
