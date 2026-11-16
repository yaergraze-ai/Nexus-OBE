import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types/domain";

export class AuthThrottleError extends Error {
  readonly status = 429;
  constructor() {
    super("Terlalu banyak percobaan. Coba kembali setelah 15 menit.");
  }
}

export interface ActiveProfileRecord {
  id: string;
  email: string;
  full_name: string;
  identity_number: string;
  role: Role;
  is_active: boolean;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  ).slice(0, 45);
}

export function hashBucket(key: string): string {
  const salt = process.env.LOGIN_RATE_LIMIT_SECRET;
  if (!salt || salt.length < 32) {
    throw new Error("LOGIN_RATE_LIMIT_SECRET harus minimal 32 karakter.");
  }
  return createHmac("sha256", salt).update(key).digest("hex");
}

export async function consumeAuthThrottle(
  admin: SupabaseClient,
  keys: string[]
): Promise<string[]> {
  const hashes = keys.map(hashBucket);
  const checks = await Promise.all(
    hashes.map((p_hash) => admin.rpc("consume_login_attempt", { p_hash }))
  );
  if (checks.some((check) => check.error)) {
    throw new Error("Proteksi login belum siap. Periksa migrasi database.");
  }
  if (checks.some((check) => check.data !== true)) {
    throw new AuthThrottleError();
  }
  return hashes;
}

export async function clearAuthThrottle(
  admin: SupabaseClient,
  hashes: string[]
): Promise<void> {
  if (!hashes.length) return;
  await Promise.allSettled(
    hashes.map((p_hash) => admin.rpc("clear_login_attempts", { p_hash }))
  );
}

/**
 * Resolves an active campus profile from email or NIM/NIDN/identity_number.
 */
export async function resolveActiveProfileByIdentifier(
  admin: SupabaseClient,
  rawIdentifier: string
): Promise<ActiveProfileRecord | null> {
  const identifier = rawIdentifier.trim().toLowerCase();
  if (!identifier) return null;

  if (identifier.includes("@")) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,full_name,identity_number,role,is_active")
      .eq("email", identifier)
      .maybeSingle();
    if (error) throw error;
    if (data?.is_active) return data as ActiveProfileRecord;

    const localMatch = identifier.match(/^[a-z]+\.([a-z0-9._-]+)@kampus\.local$/i);
    if (localMatch?.[1]) {
      const { data: byId } = await admin
        .from("profiles")
        .select("id,email,full_name,identity_number,role,is_active")
        .ilike("identity_number", localMatch[1])
        .maybeSingle();
      if (byId?.is_active) return byId as ActiveProfileRecord;
    }
    return null;
  }

  if (!/^(?=.*\d)[a-z0-9._-]{4,30}$/.test(identifier)) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,full_name,identity_number,role,is_active")
    .ilike("identity_number", identifier)
    .maybeSingle();
  if (error) throw error;
  return data?.is_active ? (data as ActiveProfileRecord) : null;
}

export async function elevateMfaIfRequired(
  db: SupabaseClient,
  totpCode?: string
): Promise<boolean> {
  const { data: aal, error: aalError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw aalError;
  if (aal?.nextLevel !== "aal2" || aal.currentLevel === "aal2") return true;
  if (!totpCode) return false;

  const { data: factors, error: factorError } = await db.auth.mfa.listFactors();
  if (factorError) throw factorError;
  const verifiedFactor = factors?.totp?.find((f) => f.status === "verified");
  if (!verifiedFactor) throw new Error("Faktor autentikator tidak ditemukan.");

  const { data: challenge, error: challengeError } = await db.auth.mfa.challenge({
    factorId: verifiedFactor.id,
  });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await db.auth.mfa.verify({
    factorId: verifiedFactor.id,
    challengeId: challenge.id,
    code: totpCode,
  });
  if (verifyError) throw new Error("Kode Authenticator (TOTP) tidak valid.");
  return true;
}

export async function enrollStudentDefaultClasses(
  admin: SupabaseClient,
  studentId: string
): Promise<void> {
  const { data: classes } = await admin
    .from("classes")
    .select("id,class_code,courses(course_code)")
    .order("class_code", { ascending: true });

  const prioritized = [...(classes ?? [])].sort((a, b) => {
    const ca = Array.isArray(a.courses) ? a.courses[0]?.course_code : (a.courses as { course_code?: string } | null)?.course_code;
    const cb = Array.isArray(b.courses) ? b.courses[0]?.course_code : (b.courses as { course_code?: string } | null)?.course_code;
    if (ca === "NEX-002" && cb !== "NEX-002") return -1;
    if (cb === "NEX-002" && ca !== "NEX-002") return 1;
    return String(a.class_code).localeCompare(String(b.class_code));
  });

  for (const klass of prioritized) {
    // Schedule conflict trigger skips overlapping classes naturally; continue enrolling valid ones.
    await admin
      .from("class_enrollments")
      .upsert({ class_id: klass.id, student_id: studentId }, { onConflict: "class_id,student_id" });
  }
}

export async function provisionStudentAccount({
  admin,
  email,
  nim,
  fullName,
  password,
  ip,
}: {
  admin: SupabaseClient;
  email: string;
  nim: string;
  fullName: string;
  password?: string;
  ip: string;
}): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanNim = nim.trim();
  const cleanName = fullName.trim();

  const [byEmail, byNim] = await Promise.all([
    admin.from("profiles").select("id").eq("email", cleanEmail).limit(1),
    admin.from("profiles").select("id").ilike("identity_number", cleanNim).limit(1),
  ]);
  if (byEmail.error || byNim.error) {
    throw new Error("Pemeriksaan data pendaftaran gagal.");
  }
  if (byEmail.data?.length || byNim.data?.length) {
    throw new Error("Email atau NIM sudah terdaftar. Silakan masuk atau gunakan Lupa Kata Sandi.");
  }

  const { error: allowErr } = await admin
    .from("account_allowlist")
    .upsert({ email: cleanEmail }, { onConflict: "email" });
  if (allowErr) throw new Error(allowErr.message);

  const accountPassword = password && password.length >= 8 ? password : randomBytes(24).toString("hex");
  const created = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: accountPassword,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || "Gagal membuat akun pengguna.");
  }

  const userId = created.data.user.id;
  await Promise.resolve(admin.rpc("sync_verified_email_identity", { p_user_id: userId })).catch(() => undefined);

  // Public self-registration is strictly scoped to the 'mahasiswa' role.
  const { error: profErr } = await admin.from("profiles").insert({
    id: userId,
    email: cleanEmail,
    identity_number: cleanNim,
    full_name: cleanName,
    role: "mahasiswa",
    is_active: true,
    must_change_password: false,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(profErr.message);
  }

  await enrollStudentDefaultClasses(admin, userId);

  await admin.from("audit_logs").insert({
    actor_id: userId,
    action: "STUDENT_SELF_REGISTERED",
    target_table: "profiles",
    target_id: userId,
    metadata: { identity_number: cleanNim },
    ip_address: ip,
  });

  return userId;
}

export async function verifyGoogleTokenInfo(
  idToken: string,
  rawNonce?: string
): Promise<{ email: string; fullName: string }> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID belum dikonfigurasi.");
  }
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error("Token Google tidak valid atau sudah kedaluwarsa.");
  }
  const payload = (await res.json()) as {
    aud?: string;
    iss?: string;
    email?: string;
    email_verified?: string | boolean;
    exp?: string;
    nonce?: string;
    name?: string;
  };
  const validIssuer =
    payload.iss === "accounts.google.com" || payload.iss === "https://accounts.google.com";
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  const expSec = Number(payload.exp || 0);
  if (
    payload.aud !== clientId ||
    !validIssuer ||
    !emailVerified ||
    !payload.email ||
    (expSec > 0 && expSec * 1000 <= Date.now())
  ) {
    throw new Error("Verifikasi identitas Google gagal.");
  }
  if (payload.nonce && rawNonce) {
    const hashed = createHash("sha256").update(rawNonce).digest("hex");
    if (payload.nonce !== hashed) {
      throw new Error("Sesi tombol Google kedaluwarsa. Muat ulang halaman lalu coba lagi.");
    }
  }
  return {
    email: payload.email.trim().toLowerCase(),
    fullName: (payload.name || payload.email.split("@")[0] || "Mahasiswa").trim().slice(0, 150),
  };
}
