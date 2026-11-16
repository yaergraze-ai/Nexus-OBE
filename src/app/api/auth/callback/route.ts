import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  safeReturnOrigin,
  sameRegisteredEmail,
  verifiedUserEmail,
} from "@/lib/security/identity";
import { mapOAuthCallbackError, safeNextPath } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = safeReturnOrigin(request);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const oauthDesc = url.searchParams.get("error_description");
  const nextPath = safeNextPath(url.searchParams.get("next"), "/dashboard");
  const fail = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, origin));

  if (oauthError) return fail(mapOAuthCallbackError(oauthError, oauthDesc));
  if (!code) return fail("auth");

  const db = await createClient();
  const exchanged = await db.auth.exchangeCodeForSession(code);
  if (exchanged.error) return fail("auth");

  const {
    data: { user },
  } = await db.auth.getUser();
  const verifiedEmail = user ? verifiedUserEmail(user) : null;
  const { data: profile } = await db
    .from("profiles")
    .select("id,email,is_active")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  if (!user || !verifiedEmail) {
    await db.auth.signOut();
    return fail("unregistered");
  }

  if (!profile) {
    const admin = adminClient();
    const { data: existingByEmail } = await admin
      .from("profiles")
      .select("id")
      .eq("email", verifiedEmail)
      .maybeSingle();
    await db.auth.signOut();
    if (!existingByEmail) {
      await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      return NextResponse.redirect(
        new URL(
          `/login?mode=register&email=${encodeURIComponent(verifiedEmail)}`,
          origin
        )
      );
    }
    return fail("unregistered");
  }

  if (!sameRegisteredEmail(verifiedEmail, profile.email)) {
    await db.auth.signOut();
    return fail("unregistered");
  }
  if (!profile.is_active) {
    await db.auth.signOut();
    return fail("inactive");
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
