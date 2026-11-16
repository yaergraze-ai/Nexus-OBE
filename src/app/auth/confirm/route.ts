import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  safeReturnOrigin,
  sameRegisteredEmail,
  verifiedUserEmail,
} from "@/lib/security/identity";
import { safeNextPath } from "@/lib/auth-helpers";

const ALLOWED_TYPES = new Set(["invite", "email", "magiclink", "recovery"]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = safeReturnOrigin(request);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const requestedNext = url.searchParams.get("next");

  if (!token_hash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  }

  const db = await createClient();
  const { error } = await db.auth.verifyOtp({
    token_hash,
    type: type as EmailOtpType,
  });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=expired_link", origin));
  }

  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: profile } = await db
    .from("profiles")
    .select("id,email,is_active")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  if (!user || !profile?.is_active || !sameRegisteredEmail(verifiedUserEmail(user), profile.email)) {
    await db.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=inactive", origin));
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/login?mode=new-password", origin));
  }

  const fallback = type === "invite" ? "/pengaturan/keamanan" : "/dashboard";
  return NextResponse.redirect(new URL(safeNextPath(requestedNext, fallback), origin));
}
