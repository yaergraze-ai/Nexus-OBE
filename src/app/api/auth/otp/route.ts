import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";
import { boundedJson } from "@/lib/security/api-session";
import { safeReturnOrigin } from "@/lib/security/identity";
import {
  escapeEmailHtml,
  isCustomMailerConfigured,
  sendPortalEmail,
} from "@/lib/security/mailer";
import {
  AuthThrottleError,
  clientIp,
  consumeAuthThrottle,
  resolveActiveProfileByIdentifier,
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const requestOtpSchema = z.object({
  email: z.email("Masukkan alamat email yang valid (contoh: nama@gmail.com).").max(150),
  purpose: z.enum(["login", "recovery"]),
});

const GENERIC_SUCCESS =
  "Jika akun aktif dan terdaftar, kode OTP 6 digit telah dikirim ke email Anda. Periksa kotak masuk atau folder spam.";

export async function POST(req: Request) {
  try {
    const body = requestOtpSchema.parse(await boundedJson(req, 4000));
    const identifier = body.email.trim().toLowerCase();
    const ip = clientIp(req);
    const admin = adminClient();
    await consumeAuthThrottle(admin, [`otp:${body.purpose}:${identifier}`, `otp:ip:${ip}`]);

    const profile = await resolveActiveProfileByIdentifier(admin, identifier);
    if (!profile) {
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
    }

    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    if (!authUser?.user) {
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
    }

    const origin = safeReturnOrigin(req);
    const redirectTo = `${origin}/auth/confirm`;

    // Prefer configured Google SMTP / Resend so the 6-digit OTP lands reliably in the user's inbox.
    if (isCustomMailerConfigured()) {
      const generated = await admin.auth.admin.generateLink(
        body.purpose === "recovery"
          ? { type: "recovery", email: profile.email, options: { redirectTo } }
          : { type: "magiclink", email: profile.email, options: { redirectTo } }
      );
      const otp = generated.data?.properties?.email_otp;
      const tokenHash = generated.data?.properties?.hashed_token;
      if (!generated.error && otp && tokenHash) {
        const isRecovery = body.purpose === "recovery";
        const confirmType = isRecovery ? "recovery" : "magiclink";
        const confirmUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(
          tokenHash
        )}&type=${confirmType}`;
        const heading = isRecovery ? "Atur Ulang Kata Sandi" : "Verifikasi Masuk Portal";
        const intro = isRecovery
          ? "Gunakan kode OTP di bawah ini untuk mengatur ulang kata sandi akun NEXUS OBE Anda:"
          : "Gunakan kode OTP di bawah ini untuk masuk ke portal akademik NEXUS OBE:";

        const result = await sendPortalEmail({
          to: profile.email,
          subject: isRecovery
            ? "Kode OTP Atur Ulang Sandi — NEXUS OBE"
            : "Kode OTP Masuk Portal — NEXUS OBE",
          text: `${heading}\n\nHalo ${profile.full_name},\n\n${intro}\n\nKode OTP: ${otp}\n\nAtau buka tautan verifikasi: ${confirmUrl}\n\nJangan bagikan kode ini kepada siapa pun.`,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;color:#19253a">
              <div style="display:inline-block;background:#8b0000;color:#ffffff;font-weight:800;font-size:12px;letter-spacing:.08em;padding:6px 12px;border-radius:999px;margin-bottom:16px">NEXUS OBE · PORTAL AKADEMIK</div>
              <h2 style="margin:0 0 8px;font-size:22px;color:#19253a">${heading}</h2>
              <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Halo <strong>${escapeEmailHtml(profile.full_name)}</strong>, ${intro}</p>
              <div style="background:#fff4f4;border:1px solid #f3c4c4;border-radius:12px;padding:18px;text-align:center;margin:20px 0">
                <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:#8b0000;text-transform:uppercase;margin-bottom:6px">KODE OTP ANDA</div>
                <div style="font-size:32px;font-weight:900;letter-spacing:.28em;color:#67060c;font-family:monospace">${escapeEmailHtml(otp)}</div>
              </div>
              <p style="margin:0 0 14px;font-size:13px;color:#64748b">Jangan berikan kode ini kepada siapa pun.</p>
              <p style="margin:0;font-size:12px;color:#64748b">Tautan cepat: <a href="${confirmUrl}" style="color:#8b0000;font-weight:700">Verifikasi Otomatis</a></p>
            </div>
          `,
        });
        if (result.sent) {
          return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
        }
      }
    }

    // Fallback to Supabase Auth's configured SMTP / email template.
    const db = await createClient();
    const result =
      body.purpose === "recovery"
        ? await db.auth.resetPasswordForEmail(profile.email, { redirectTo })
        : await db.auth.signInWithOtp({
            email: profile.email,
            options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
          });

    if (result.error) {
      const msg = result.error.message.toLowerCase();
      if (msg.includes("rate") || msg.includes("seconds") || result.error.status === 429) {
        return apiError(new Error("Tunggu 60 detik sebelum meminta kode OTP baru."), 429);
      }
      throw new Error(
        "Pengiriman OTP gagal. Periksa pengaturan Google SMTP di .env atau Supabase Dashboard."
      );
    }

    return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}
