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
  enrollStudentDefaultClasses,
  provisionStudentAccount,
  verifyGoogleTokenInfo,
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const googleSchema = z.object({
  credential: z.string().min(20).max(8000),
  nonce: z.string().min(8).max(256).optional(),
  nim: z
    .string()
    .trim()
    .regex(/^(?=.*\d)[a-zA-Z0-9._-]{4,30}$/, "Masukkan NIM yang valid (4–30 karakter).")
    .optional(),
  fullName: z.string().trim().min(3).max(150).optional(),
});

async function establishVerifiedGoogleSession(
  db: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof adminClient>,
  email: string,
  credential: string,
  nonce?: string
): Promise<boolean> {
  const native = await db.auth.signInWithIdToken({
    provider: "google",
    token: credential,
    nonce,
  });
  if (!native.error) return true;

  // Fallback for accounts created with email+password before email_verified identity sync ran:
  // Google tokeninfo already cryptographically verified email & nonce above.
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return false;

  const verified = await db.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  return !verified.error;
}

export async function POST(req: Request) {
  try {
    const body = googleSchema.parse(await boundedJson(req, 12000));
    const ip = clientIp(req);
    const admin = adminClient();
    const hashes = await consumeAuthThrottle(admin, [`google-id:ip:${ip}`]);

    const googleUser = await verifyGoogleTokenInfo(body.credential, body.nonce);

    const { data: existingProfile, error: profQueryErr } = await admin
      .from("profiles")
      .select("id,email,role,is_active")
      .eq("email", googleUser.email)
      .maybeSingle();
    if (profQueryErr) throw new Error("Pemeriksaan profil gagal.");

    const db = await createClient();

    if (!existingProfile) {
      if (!body.nim) {
        return NextResponse.json({
          ok: false,
          needsRegistration: true,
          email: googleUser.email,
          fullName: googleUser.fullName,
        });
      }

      await provisionStudentAccount({
        admin,
        email: googleUser.email,
        nim: body.nim,
        fullName: body.fullName || googleUser.fullName,
        ip,
      });

      const signedIn = await establishVerifiedGoogleSession(
        db,
        admin,
        googleUser.email,
        body.credential,
        body.nonce
      );
      if (!signedIn) {
        throw new Error("Akun dibuat, namun sesi Google belum aktif. Silakan klik Masuk Google sekali lagi.");
      }

      await clearAuthThrottle(admin, hashes);
      return NextResponse.json({ ok: true, role: "mahasiswa" });
    }

    if (!existingProfile.is_active) {
      return apiError(new Error("Akun kampus Anda sedang dinonaktifkan."), 403);
    }

    const canonicalEmail = existingProfile.email.trim().toLowerCase();
    await admin
      .from("account_allowlist")
      .upsert({ email: canonicalEmail }, { onConflict: "email" });
    await admin.auth.admin
      .updateUserById(existingProfile.id, { email: canonicalEmail, email_confirm: true })
      .catch(() => undefined);
    await Promise.resolve(
      admin.rpc("sync_verified_email_identity", { p_user_id: existingProfile.id })
    ).catch(() => undefined);

    if (existingProfile.role === "mahasiswa") {
      const { count } = await admin
        .from("class_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("student_id", existingProfile.id);
      if ((count ?? 0) === 0) {
        await enrollStudentDefaultClasses(admin, existingProfile.id);
      }
    }

    const signedIn = await establishVerifiedGoogleSession(
      db,
      admin,
      canonicalEmail,
      body.credential,
      body.nonce
    );
    if (!signedIn) {
      return apiError(new Error("Autentikasi Google gagal. Silakan coba lagi."), 401);
    }

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user || !sameRegisteredEmail(verifiedUserEmail(user), existingProfile.email)) {
      await db.auth.signOut();
      return apiError(
        new Error("Email Google tidak cocok dengan identitas terdaftar pada portal kampus."),
        403
      );
    }

    await clearAuthThrottle(admin, hashes);
    return NextResponse.json({ ok: true, role: existingProfile.role });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}
