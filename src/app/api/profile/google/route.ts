import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { verifyGoogleTokenInfo } from "@/lib/security/auth-flow";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  credential: z.string().min(20).max(8000),
  nonce: z.string().min(8).max(256).optional(),
});

export async function POST(req: Request) {
  try {
    const { profile } = await apiSession();
    const body = schema.parse(await boundedJson(req, 12000));
    const googleUser = await verifyGoogleTokenInfo(body.credential, body.nonce);

    const admin = adminClient();
    const { data: conflict } = await admin
      .from("profiles")
      .select("id")
      .eq("email", googleUser.email)
      .neq("id", profile.id)
      .maybeSingle();
    if (conflict) {
      return apiError(
        new Error(`Email Google ${googleUser.email} sudah dipakai akun portal lain.`),
        409
      );
    }

    const oldEmail = profile.email;
    const { error: allowErr } = await admin
      .from("account_allowlist")
      .upsert({ email: googleUser.email }, { onConflict: "email" });
    if (allowErr) throw new Error(allowErr.message);

    const authUpd = await admin.auth.admin.updateUserById(profile.id, {
      email: googleUser.email,
      email_confirm: true,
    });
    if (authUpd.error) throw new Error(authUpd.error.message);

    await Promise.resolve(
      admin.rpc("sync_verified_email_identity", { p_user_id: profile.id })
    ).catch(() => undefined);

    let profUpd = await admin
      .from("profiles")
      .update({
        email: googleUser.email,
        personal_email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (
      profUpd.error &&
      /personal_email_verified|42703/i.test(profUpd.error.message)
    ) {
      profUpd = await admin
        .from("profiles")
        .update({ email: googleUser.email, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
    }
    if (profUpd.error) throw new Error(profUpd.error.message);

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "GOOGLE_ACCOUNT_LINKED",
      target_table: "profiles",
      target_id: profile.id,
      metadata: { old_email: oldEmail, new_email: googleUser.email },
    });

    return NextResponse.json({
      ok: true,
      email: googleUser.email,
      message: `Akun Google ${googleUser.email} terhubung. Anda kini dapat login lewat tombol Google, email OTP, atau kata sandi.`,
    });
  } catch (e) {
    return apiError(e);
  }
}
