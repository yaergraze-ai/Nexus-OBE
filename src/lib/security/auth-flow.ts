import "server-only";
import { createHmac } from "node:crypto";
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
 * Resolves an active campus profile from email (all roles) or identity_number (non-mahasiswa only).
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
    return data?.is_active ? (data as ActiveProfileRecord) : null;
  }

  if (!/^[0-9]{6,30}$/.test(identifier)) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,full_name,identity_number,role,is_active")
    .eq("identity_number", identifier)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_active || data.role === "mahasiswa") return null;
  return data as ActiveProfileRecord;
}
