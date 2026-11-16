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
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const googleSchema = z.object({
  credential: z.string().min(20).max(8000),
  nonce: z.string().min(8).max(256).optional(),
});

export async function POST(req: Request) {
  try {
    const body = googleSchema.parse(await boundedJson(req, 12000));
    const ip = clientIp(req);
    const admin = adminClient();
    const hashes = await consumeAuthThrottle(admin, [`google-id:ip:${ip}`]);

    const db = await createClient();
    const { error } = await db.auth.signInWithIdToken({
      provider: "google",
      token: body.credential,
      nonce: body.nonce,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("diundang") || msg.includes("allowlist") || error.status === 403) {
        return apiError(
          new Error("Akun Google Anda belum terdaftar pada portal kampus. Hubungi admin kampus."),
          403
        );
      }
      return apiError(new Error("Autentikasi Google gagal. Silakan coba lagi."), 401);
    }

    const {
      data: { user },
    } = await db.auth.getUser();
    const { data: profile } = await db
      .from("profiles")
      .select("id,email,role,is_active")
      .eq("id", user?.id ?? "")
      .maybeSingle();

    if (!user || !profile || !sameRegisteredEmail(verifiedUserEmail(user), profile.email)) {
      await db.auth.signOut();
      return apiError(
        new Error(
          "Akun Google Anda belum terdaftar pada portal kampus atau email tidak cocok."
        ),
        403
      );
    }
    if (!profile.is_active) {
      await db.auth.signOut();
      return apiError(new Error("Akun kampus Anda sedang dinonaktifkan."), 403);
    }

    await clearAuthThrottle(admin, hashes);
    return NextResponse.json({ ok: true, role: profile.role });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}

