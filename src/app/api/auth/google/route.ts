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
  expectedUserId: string,
  email: string,
  credential: string,
  nonce?: string
): Promise<boolean> {
  const native = await db.auth.signInWithIdToken({
    provider: "google",
    token: credential,
    nonce,
  });
  if (!native.error && native.data.user?.id === expectedUserId) return true;
  if (!native.error && native.data.user?.id !== expectedUserId) {
    await db.auth.signOut();
  }

  // Fallback when Google identity is not yet linked to expectedUserId:
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
  return !verified.error && verified.data.user?.id === expectedUserId;
}

export async function POST(req: Request) {
  try {
    const body = googleSchema.parse(await boundedJson(req, 12000));
    const ip = clientIp(req);
    const admin = adminClient();
    const hashes = await consumeAuthThrottle(admin, [`google-id:ip:${ip}`]);

    const googleUser = await verifyGoogleTokenInfo(body.credential, body.nonce);

    const { data: initialProfile, error: profQueryErr } = await admin
      .from("profiles")
      .select("id,email,role,is_active")
      .eq("email", googleUser.email)
      .maybeSingle();
    if (profQueryErr) throw new Error("Pemeriksaan profil gagal.");
    let existingProfile = initialProfile;

    if (!existingProfile) {
      const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of usersList?.users ?? []) {
        const full = await admin.auth.admin.getUserById(u.id);
        const hasLinkedGoogle = (full.data.user?.identities ?? []).some(
          (i) =>
            i.provider === "google" &&
            typeof i.identity_data?.email === "string" &&
            i.identity_data.email.trim().toLowerCase() === googleUser.email
        );
        if (hasLinkedGoogle) {
          const { data: linkedProf } = await admin
            .from("profiles")
            .select("id,email,role,is_active")
            .eq("id", u.id)
            .maybeSingle();
          if (linkedProf) {
            existingProfile = linkedProf;
            break;
          }
        }
      }
    }

    const db = await createClient();
    await db.auth.signOut();

    if (!existingProfile) {
      if (!body.nim) {
        return NextResponse.json({
          ok: false,
          needsRegistration: true,
          email: googleUser.email,
          fullName: googleUser.fullName,
        });
      }

      const createdUserId = await provisionStudentAccount({
        admin,
        email: googleUser.email,
        nim: body.nim,
        fullName: body.fullName || googleUser.fullName,
        ip,
      });

      const signedIn = await establishVerifiedGoogleSession(
        db,
        admin,
        createdUserId,
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
      existingProfile.id,
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
    if (!user || !sameRegisteredEmail(verifiedUserEmail(user), existingProfile.email, user)) {
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
