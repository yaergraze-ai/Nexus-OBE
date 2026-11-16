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
      if (msg.includes("not enabled") || msg.includes("unsupported provider")) {
        return apiError(
          new Error(
            "Login Google belum diaktifkan di Supabase (buka Authentication → Providers → Google, nyalakan Google & isi Client ID)."
          ),
          503
        );
      }
      if (msg.includes("audience") || msg.includes("client_id")) {
        return apiError(
          new Error(
            "Client ID Google di Supabase belum cocok dengan Google Cloud Console."
          ),
          400
        );
      }
      if (msg.includes("nonce")) {
        return apiError(
          new Error("Sesi tombol Google kedaluwarsa. Muat ulang halaman lalu coba lagi."),
          400
        );
      }
      if (msg.includes("diundang") || msg.includes("allowlist") || error.status === 403) {
        return apiError(
          new Error(
            "Akun Google Anda belum terdaftar di portal. Daftar dahulu di tab Daftar (Mahasiswa) atau hubungi admin kampus."
          ),
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
      if (user && !profile) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
      return apiError(
        new Error(
          "Akun Google Anda belum terdaftar pada portal kampus atau email tidak cocok. Gunakan tab Daftar atau minta admin mengundang email Anda."
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

