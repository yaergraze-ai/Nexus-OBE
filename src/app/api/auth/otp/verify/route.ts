import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";
import { boundedJson } from "@/lib/security/api-session";
import { sameRegisteredEmail, verifiedUserEmail } from "@/lib/security/identity";
import {
  AuthThrottleError,
  clearAuthThrottle,
  clientIp,
  consumeAuthThrottle,
  elevateMfaIfRequired,
  resolveActiveProfileByIdentifier,
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const verifySchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("login"),
    email: z.email("Masukkan alamat email yang valid (contoh: nama@gmail.com).").max(150),
    token: z.string().trim().regex(/^[0-9]{6,10}$/, "Kode OTP harus 6–10 digit angka."),
  }),
  z.object({
    purpose: z.literal("recovery"),
    email: z.email("Masukkan alamat email yang valid (contoh: nama@gmail.com).").max(150),
    token: z.string().trim().regex(/^[0-9]{6,10}$/, "Kode OTP harus 6–10 digit angka."),
    password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
    totpCode: z.string().trim().regex(/^[0-9]{6}$/).optional(),
  }),
  z.object({
    purpose: z.literal("complete-recovery"),
    password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
    totpCode: z.string().trim().regex(/^[0-9]{6}$/).optional(),
  }),
]);

export async function POST(req: Request) {
  try {
    const body = verifySchema.parse(await boundedJson(req, 4000));
    const ip = clientIp(req);
    const admin = adminClient();
    const db = await createClient();

    if (body.purpose === "complete-recovery") {
      const hashes = await consumeAuthThrottle(admin, [`otp-complete:ip:${ip}`]);
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return apiError(new Error("Sesi pemulihan tidak ditemukan atau kedaluwarsa."), 401);

      const { data: profile } = await db
        .from("profiles")
        .select("id,email,is_active")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.is_active || !sameRegisteredEmail(verifiedUserEmail(user), profile.email)) {
        await db.auth.signOut();
        return apiError(new Error("Akun belum aktif atau tidak cocok."), 403);
      }

      const ready = await elevateMfaIfRequired(db, body.totpCode);
      if (!ready) {
        return NextResponse.json({
          ok: false,
          requiresMfa: true,
          message:
            "Akun Anda dilindungi Authenticator (TOTP). Masukkan kode 6 digit untuk menyelesaikan perubahan sandi.",
        });
      }

      const { error: updateError } = await db.auth.updateUser({ password: body.password });
      if (updateError) return apiError(updateError, 400);

      await admin
        .from("profiles")
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      await admin.from("audit_logs").insert({
        actor_id: profile.id,
        action: "PASSWORD_RESET",
        target_table: "auth",
        target_id: profile.id,
        metadata: { method: "recovery" },
        ip_address: ip,
      });
      await db.auth.signOut();
      await clearAuthThrottle(admin, hashes);
      return NextResponse.json({ ok: true });
    }

    const identifier = body.email.trim().toLowerCase();
    const hashes = await consumeAuthThrottle(admin, [
      `otp-verify:${body.purpose}:${identifier}`,
      `otp-verify:ip:${ip}`,
    ]);

    const profile = await resolveActiveProfileByIdentifier(admin, identifier);
    if (!profile) {
      return apiError(new Error("Kode OTP salah, kedaluwarsa, atau akun belum aktif."), 401);
    }

    const verifyType = body.purpose === "recovery" ? "recovery" : "email";
    const { error: otpError } = await db.auth.verifyOtp({
      email: profile.email,
      token: body.token.trim(),
      type: verifyType,
    });
    if (otpError) {
      await admin.from("audit_logs").insert({
        actor_id: null,
        action: "OTP_VERIFY_FAILED",
        target_table: "auth",
        target_id: profile.id,
        metadata: { purpose: body.purpose },
        ip_address: ip,
      });
      return apiError(new Error("Kode OTP salah atau sudah kedaluwarsa."), 401);
    }

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user || !sameRegisteredEmail(verifiedUserEmail(user), profile.email)) {
      await db.auth.signOut();
      return apiError(new Error("Akun tidak aktif atau email tidak cocok."), 403);
    }

    if (body.purpose === "login") {
      await clearAuthThrottle(admin, hashes);
      return NextResponse.json({ ok: true, role: profile.role });
    }

    const ready = await elevateMfaIfRequired(db, body.totpCode);
    if (!ready) {
      await clearAuthThrottle(admin, hashes);
      return NextResponse.json({
        ok: false,
        requiresMfa: true,
        message:
          "Kode OTP email terverifikasi. Masukkan kode 6 digit dari aplikasi Authenticator (TOTP) Anda.",
      });
    }

    const { error: updateError } = await db.auth.updateUser({ password: body.password });
    if (updateError) return apiError(updateError, 400);

    await admin
      .from("profiles")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "PASSWORD_RESET",
      target_table: "auth",
      target_id: profile.id,
      metadata: { method: "otp" },
      ip_address: ip,
    });
    await db.auth.signOut();
    await clearAuthThrottle(admin, hashes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}
