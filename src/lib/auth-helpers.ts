export type AuthMode = "password" | "otp" | "register" | "recovery" | "new-password";

const ERROR_MESSAGES: Record<string, string> = {
  unregistered:
    "Akun Google atau email Anda belum terdaftar pada portal kampus atau email tidak cocok. Hubungi admin kampus.",
  inactive:
    "Akun belum aktif atau email belum terverifikasi. Periksa undangan atau hubungi admin kampus.",
  cancelled: "Masuk dengan Google dibatalkan.",
  auth: "Autentikasi gagal atau sesi kedaluwarsa. Silakan coba lagi.",
  invalid_link: "Tautan verifikasi tidak valid. Minta kode OTP baru.",
  expired_link: "Tautan atau kode verifikasi sudah kedaluwarsa. Silakan minta ulang.",
  setup: "Konfigurasi Supabase belum lengkap pada server.",
  forbidden: "Anda tidak memiliki izin untuk halaman tersebut.",
};

export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}

export function authErrorMessage(code: string | null | undefined): string {
  if (!code) return "";
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.auth;
}

export function mapOAuthCallbackError(error: string | null, description: string | null): string {
  const err = (error ?? "").toLowerCase();
  const desc = (description ?? "").toLowerCase();
  if (err === "access_denied" || desc.includes("cancel")) return "cancelled";
  if (desc.includes("diundang") || desc.includes("allowlist") || desc.includes("unregistered")) {
    return "unregistered";
  }
  return "auth";
}

export function cleanOtpToken(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

export function isValidOtpToken(raw: string): boolean {
  return /^[0-9]{6,10}$/.test(raw.trim());
}

export function isValidIdentifier(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 150) return false;
  if (value.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  return /^(?=.*\d)[a-z0-9._-]{4,30}$/.test(value);
}

export function parseInitialAuthMode(mode: string | null | undefined): AuthMode {
  if (mode === "otp" || mode === "register" || mode === "recovery" || mode === "new-password") {
    return mode;
  }
  return "password";
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  validLength: boolean;
  hasLettersAndNumbers: boolean;
  hasSymbolOrCase: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const validLength = password.length >= 8;
  const hasLettersAndNumbers = /[a-zA-Z]/.test(password) && /\d/.test(password);
  const hasSymbolOrCase =
    (/[a-z]/.test(password) && /[A-Z]/.test(password)) || /[^a-zA-Z0-9]/.test(password);

  if (!password) {
    return {
      score: 0,
      label: "Minimal 8 karakter",
      validLength: false,
      hasLettersAndNumbers: false,
      hasSymbolOrCase: false,
    };
  }
  if (!validLength) {
    return {
      score: 1,
      label: "Terlalu pendek",
      validLength,
      hasLettersAndNumbers,
      hasSymbolOrCase,
    };
  }
  const bonus =
    (hasLettersAndNumbers ? 1 : 0) +
    (hasSymbolOrCase ? 1 : 0) +
    (password.length >= 12 ? 1 : 0);

  if (bonus >= 3) {
    return {
      score: 4,
      label: "Sangat kuat",
      validLength,
      hasLettersAndNumbers,
      hasSymbolOrCase,
    };
  }
  if (bonus === 2) {
    return {
      score: 3,
      label: "Kuat",
      validLength,
      hasLettersAndNumbers,
      hasSymbolOrCase,
    };
  }
  return {
    score: 2,
    label: "Cukup",
    validLength,
    hasLettersAndNumbers,
    hasSymbolOrCase,
  };
}
