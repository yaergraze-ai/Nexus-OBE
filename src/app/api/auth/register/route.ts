import { NextResponse } from "next/server";
import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";
import { boundedJson } from "@/lib/security/api-session";
import { escapeEmailHtml, sendPortalEmail } from "@/lib/security/mailer";
import {
  AuthThrottleError,
  clearAuthThrottle,
  clientIp,
  consumeAuthThrottle,
  hashBucket,
  provisionStudentAccount,
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const requestSchema = z.object({
  action: z.literal("request"),
  fullName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter.").max(150),
  nim: z
    .string()
    .trim()
    .regex(/^(?=.*\d)[a-zA-Z0-9._-]{4,30}$/, "Masukkan NIM yang valid (4–30 karakter)."),
  email: z.email("Masukkan alamat email yang valid (contoh: nama@gmail.com).").max(150),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  fullName: z.string().trim().min(3).max(150),
  nim: z
    .string()
    .trim()
    .regex(/^(?=.*\d)[a-zA-Z0-9._-]{4,30}$/),
  email: z.email().max(150),
  password: z.string().min(8).max(128),
  otp: z.string().trim().regex(/^[0-9]{6}$/, "Kode OTP harus 6 digit angka."),
});

const registerSchema = z.discriminatedUnion("action", [requestSchema, verifySchema]);

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await boundedJson(req, 6000));
    const email = body.email.trim().toLowerCase();
    const nim = body.nim.trim();
    const fullName = body.fullName.trim();
    const ip = clientIp(req);
    const admin = adminClient();

    const [byEmail, byNim] = await Promise.all([
      admin.from("profiles").select("id").eq("email", email).limit(1),
      admin.from("profiles").select("id").ilike("identity_number", nim).limit(1),
    ]);
    if (byEmail.error || byNim.error) {
      throw new Error("Pemeriksaan data pendaftaran gagal.");
    }
    if (byEmail.data?.length || byNim.data?.length) {
      return apiError(
        new Error(
          "Email atau NIM sudah terdaftar. Silakan masuk atau gunakan Lupa Kata Sandi."
        ),
        409
      );
    }

    if (body.action === "request") {
      await consumeAuthThrottle(admin, [`reg-req:email:${email}`, `reg-req:ip:${ip}`]);
      const otp = randomInt(100000, 1000000).toString();
      const otpHash = hashBucket(`register:${email}:${otp}`);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: upsertErr } = await admin.from("pending_signups").upsert(
        {
          email,
          identity_number: nim,
          full_name: fullName,
          otp_hash: otpHash,
          attempts: 0,
          expires_at: expiresAt,
        },
        { onConflict: "email" }
      );
      if (upsertErr) {
        throw new Error(
          "Tabel pendaftaran belum siap. Pastikan migrasi SQL 006 sudah dijalankan di Supabase."
        );
      }

      const delivered = await sendPortalEmail({
        to: email,
        subject: "Kode OTP Pendaftaran Akun — NEXUS OBE",
        text: `Halo ${fullName},\n\nGunakan kode OTP berikut untuk menyelesaikan pendaftaran akun mahasiswa (NIM ${nim}) di NEXUS OBE:\n\nKode OTP: ${otp}\n\nKode berlaku 15 menit. Jangan bagikan kode ini kepada siapa pun.`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;color:#19253a">
            <div style="display:inline-block;background:#8b0000;color:#ffffff;font-weight:800;font-size:12px;letter-spacing:.08em;padding:6px 12px;border-radius:999px;margin-bottom:16px">NEXUS OBE · PENDAFTARAN</div>
            <h2 style="margin:0 0 8px;font-size:21px">Verifikasi Pendaftaran Akun</h2>
            <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Halo <strong>${escapeEmailHtml(fullName)}</strong> (NIM <strong>${escapeEmailHtml(nim)}</strong>), masukkan kode OTP berikut untuk mengaktifkan akun Anda:</p>
            <div style="background:#fff4f4;border:1px solid #f3c4c4;border-radius:12px;padding:18px;text-align:center;margin:20px 0">
              <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:#8b0000;text-transform:uppercase;margin-bottom:6px">KODE OTP PENDAFTARAN</div>
              <div style="font-size:32px;font-weight:900;letter-spacing:.28em;color:#67060c;font-family:monospace">${otp}</div>
            </div>
            <p style="margin:0;font-size:12px;color:#64748b">Berlaku 15 menit. Jangan berikan kode ini kepada siapa pun.</p>
          </div>
        `,
      });

      if (!delivered.sent) {
        await admin.from("pending_signups").delete().eq("email", email);
        throw new Error(
          "Pengiriman email OTP belum aktif. Isi konfigurasi Google SMTP (SMTP_USER & SMTP_PASS) pada server."
        );
      }

      return NextResponse.json({
        ok: true,
        message: `Kode OTP 6 digit telah dikirim ke ${email}. Periksa kotak masuk atau folder spam.`,
      });
    }

    const hashes = await consumeAuthThrottle(admin, [
      `reg-ver:email:${email}`,
      `reg-ver:ip:${ip}`,
    ]);
    const { data: pending, error: pendingErr } = await admin
      .from("pending_signups")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (pendingErr || !pending) {
      return apiError(
        new Error("Permintaan OTP pendaftaran tidak ditemukan atau sudah kedaluwarsa."),
        400
      );
    }
    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await admin.from("pending_signups").delete().eq("email", email);
      return apiError(new Error("Kode OTP kedaluwarsa. Silakan kirim ulang kode baru."), 400);
    }
    if (pending.attempts >= 5) {
      await admin.from("pending_signups").delete().eq("email", email);
      return apiError(
        new Error("Terlalu banyak percobaan OTP salah. Silakan minta kode OTP baru."),
        429
      );
    }

    const expected = Buffer.from(pending.otp_hash, "hex");
    const given = Buffer.from(hashBucket(`register:${email}:${body.otp.trim()}`), "hex");
    const matches =
      expected.length === given.length && timingSafeEqual(expected, given);

    if (!matches || pending.identity_number.toLowerCase() !== nim.toLowerCase()) {
      await admin
        .from("pending_signups")
        .update({ attempts: pending.attempts + 1 })
        .eq("email", email);
      return apiError(new Error("Kode OTP tidak valid."), 401);
    }

    await admin.from("pending_signups").delete().eq("email", email);

    await provisionStudentAccount({
      admin,
      email,
      nim,
      fullName,
      password: body.password,
      ip,
    });

    const db = await createClient();
    await db.auth.signInWithPassword({ email, password: body.password });
    await clearAuthThrottle(admin, hashes);

    return NextResponse.json({ ok: true, role: "mahasiswa" });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}
