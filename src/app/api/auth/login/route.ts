import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";
import { boundedJson } from "@/lib/security/api-session";
import { sameRegisteredEmail, verifiedUserEmail } from "@/lib/security/identity";
import { isValidIdentifier } from "@/lib/auth-helpers";
import {
  AuthThrottleError,
  clearAuthThrottle,
  clientIp,
  consumeAuthThrottle,
  resolveActiveProfileByIdentifier,
} from "@/lib/security/auth-flow";

export const runtime = "nodejs";

const credentials = z.object({
  identifier: z.string().trim().min(4).max(150),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const body = credentials.parse(await boundedJson(req, 4000));
    const identifier = body.identifier.trim().toLowerCase();
    if (!isValidIdentifier(identifier)) {
      return apiError(new Error("Gunakan NIM, NIDN, atau email yang valid."), 400);
    }

    const ip = clientIp(req);
    const admin = adminClient();
    const hashes = await consumeAuthThrottle(admin, [`account:${identifier}`, `ip:${ip}`]);

    let email = identifier;
    if (!identifier.includes("@")) {
      // A login identifier is not an authorization credential. Always verify the password too.
      const resolved = await resolveActiveProfileByIdentifier(admin, identifier);
      email = resolved ? resolved.email : "invalid-login@invalid.example";
    }

    const db = await createClient();
    const { error } = await db.auth.signInWithPassword({ email, password: body.password });
    if (error) {
      await admin.from("audit_logs").insert({
        actor_id: null,
        action: "LOGIN_FAILED",
        target_table: "auth",
        target_id: null,
        metadata: { account_bucket: hashes[0].slice(0, 16) },
        ip_address: ip,
      });
      return apiError(new Error("NIM/NIDN/email atau kata sandi tidak valid."), 401);
    }

    const {
      data: { user },
    } = await db.auth.getUser();
    const { data: profile } = await db
      .from("profiles")
      .select("id,is_active,role,email,identity_number")
      .eq("id", user?.id ?? "")
      .maybeSingle();

    if (
      !profile?.is_active ||
      !sameRegisteredEmail(user ? verifiedUserEmail(user) : null, profile.email, user) ||
      (!identifier.includes("@") &&
        profile.identity_number.trim().toLowerCase() !== identifier)
    ) {
      await db.auth.signOut();
      return apiError(
        new Error("Akun belum disetujui atau email tidak cocok dengan identitas kampus."),
        403
      );
    }

    // Detect initial lecturer password equal to NIDN so the lecturer dashboard prompts password update.
    if (
      profile.role === "dosen" &&
      body.password.trim().toLowerCase() === profile.identity_number.trim().toLowerCase()
    ) {
      await admin
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", profile.id);
    }

    await clearAuthThrottle(admin, hashes);
    return NextResponse.json({ ok: true, role: profile.role });
  } catch (e) {
    return apiError(e, e instanceof AuthThrottleError ? 429 : 400);
  }
}
