import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";
import { boundedJson } from "@/lib/security/api-session";
import { safeReturnOrigin } from "@/lib/security/identity";
import { isValidIdentifier } from "@/lib/auth-helpers";
import {
  AuthThrottleError,
  clientIp,
  consumeAuthThrottle,
  resolveActiveProfileByIdentifier,
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const requestOtpSchema = z.object({
  identifier: z.string().trim().min(4).max(150),
  purpose: z.enum(["login", "recovery"]),
});

const GENERIC_SUCCESS =
  "Jika akun aktif dan terdaftar, kode OTP 6 digit telah dikirim ke email kampus Anda. Periksa kotak masuk atau folder spam.";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}

async function sendViaResend(params: {
  to: string;
  fullName: string;
  otp: string;
  tokenHash: string;
  purpose: "login" | "recovery";
  origin: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return false;

  const isRecovery = params.purpose === "recovery";
  const subject = isRecovery
    ? "Kode OTP Atur Ulang Sandi — NEXUS OBE"
    : "Kode OTP Masuk Portal — NEXUS OBE";
  const confirmType = isRecovery ? "recovery" : "magiclink";
  const confirmUrl = `${params.origin}/auth/confirm?token_hash=${encodeURIComponent(
    params.tokenHash
  )}&type=${confirmType}`;
  const heading = isRecovery ? "Atur Ulang Kata Sandi" : "Verifikasi Masuk Portal";
  const intro = isRecovery
    ? "Gunakan kode OTP di bawah ini untuk mengatur ulang kata sandi akun NEXUS OBE Anda:"
    : "Gunakan kode OTP di bawah ini untuk masuk ke portal akademik NEXUS OBE:";
  const safeName = escapeHtml(params.fullName);
  const safeOtp = escapeHtml(params.otp);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        text: `${heading}\n\nHalo ${params.fullName},\n\n${intro}\n\nKode OTP: ${params.otp}\n\nAtau buka tautan verifikasi: ${confirmUrl}\n\nJangan bagikan kode ini kepada siapa pun. Abaikan email ini jika bukan Anda yang meminta.`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;color:#19253a">
            <div style="display:inline-block;background:#8b0000;color:#ffffff;font-weight:800;font-size:12px;letter-spacing:.08em;padding:6px 12px;border-radius:999px;margin-bottom:16px">NEXUS OBE · PORTAL AKADEMIK</div>
            <h2 style="margin:0 0 8px;font-size:22px;color:#19253a">${heading}</h2>
            <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Halo <strong>${safeName}</strong>, ${intro}</p>
            <div style="background:#fff4f4;border:1px solid #f3c4c4;border-radius:12px;padding:18px;text-align:center;margin:20px 0">
              <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:#8b0000;text-transform:uppercase;margin-bottom:6px">KODE OTP ANDA</div>
              <div style="font-size:32px;font-weight:900;letter-spacing:.28em;color:#67060c;font-family:monospace">${safeOtp}</div>
            </div>
            <p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.5">Jangan berikan kode ini kepada siapa pun. Jika tidak meminta kode ini, Anda dapat mengabaikan email ini.</p>
            <p style="margin:0;font-size:12px;color:#64748b">Alternatif tautan cepat: <a href="${confirmUrl}" style="color:#8b0000;font-weight:700">Verifikasi Otomatis</a></p>
          </div>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = requestOtpSchema.parse(await boundedJson(req, 4000));
    if (!isValidIdentifier(body.identifier)) {
      return apiError(new Error("Masukkan email kampus atau nomor induk dosen/staf yang valid."), 400);
    }

    const identifier = body.identifier.trim().toLowerCase();
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

    // Prefer Resend when configured so the 6-digit OTP lands reliably in the user's inbox.
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
      const generated = await admin.auth.admin.generateLink(
        body.purpose === "recovery"
          ? { type: "recovery", email: profile.email, options: { redirectTo } }
          : { type: "magiclink", email: profile.email, options: { redirectTo } }
      );
      const otp = generated.data?.properties?.email_otp;
      const tokenHash = generated.data?.properties?.hashed_token;
      if (!generated.error && otp && tokenHash) {
        const sent = await sendViaResend({
          to: profile.email,
          fullName: profile.full_name,
          otp,
          tokenHash,
          purpose: body.purpose,
          origin,
        });
        if (sent) {
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
      throw new Error("Pengiriman OTP sedang terkendala. Periksa konfigurasi email/SMTP Supabase.");
    }

    return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}
