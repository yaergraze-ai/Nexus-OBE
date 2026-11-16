import "server-only";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types/domain";
import { sameRegisteredEmail, verifiedUserEmail } from "@/lib/security/identity";

export async function sessionContext() {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (
    !profile ||
    !profile.is_active ||
    !sameRegisteredEmail(verifiedUserEmail(user), profile.email, user)
  ) {
    await db.auth.signOut();
    redirect("/login?error=inactive");
  }
  return { db, user, profile: profile as Profile };
}

export async function requireRole(...roles: Role[]) {
  const ctx = await sessionContext();
  if (!roles.includes(ctx.profile.role)) redirect("/dashboard?error=forbidden");
  return ctx;
}
