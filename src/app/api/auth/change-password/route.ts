import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, elevateMfaIfRequired } from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const schema = z.object({
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
  totpCode: z.string().trim().regex(/^[0-9]{6}$/).optional(),
});

export async function POST(req: Request) {
  try {
    const { db, profile } = await apiSession();
    const body = schema.parse(await boundedJson(req, 4000));

    if (
      body.password.trim().toLowerCase() ===
      profile.identity_number.trim().toLowerCase()
    ) {
      return apiError(
        new Error("Kata sandi baru tidak boleh sama dengan NIM atau NIDN Anda."),
        400
      );
    }

    const ready = await elevateMfaIfRequired(db, body.totpCode);
    if (!ready) {
      return NextResponse.json({
        ok: false,
        requiresMfa: true,
        message:
          "Akun Anda dilindungi Authenticator (TOTP). Masukkan kode 6 digit untuk menyimpan kata sandi baru.",
      });
    }

    const { error } = await db.auth.updateUser({ password: body.password });
    if (error) return apiError(error, 400);

    const admin = adminClient();
    await admin
      .from("profiles")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "PASSWORD_CHANGED",
      target_table: "profiles",
      target_id: profile.id,
      metadata: { role: profile.role },
      ip_address: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 400);
  }
}

