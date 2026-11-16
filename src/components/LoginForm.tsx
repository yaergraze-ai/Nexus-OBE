"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
} from "framer-motion";
import { browserClient } from "@/lib/supabase/browser";
import { cleanOtpToken, isValidOtpToken, type AuthMode } from "@/lib/auth-helpers";
import { useDeviceAdaptive } from "@/hooks/useDeviceAdaptive";
import { PasswordStrengthInput } from "@/components/PasswordStrengthInput";

interface LoginFormProps {
  initialMode?: AuthMode;
  initialError?: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            nonce?: string;
            callback: (res: GoogleCredentialResponse) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              shape?: "rectangular" | "pill" | "circle" | "square";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.94 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76Z"
      />
    </svg>
  );
}

async function createNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  const hashed = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  return { raw, hashed };
}

export function LoginForm({
  initialMode = "password",
  initialError = "",
}: LoginFormProps) {
  const { device, reducedMotion } = useDeviceAdaptive();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [otpRequested, setOtpRequested] = useState(false);
  const [registerRequested, setRegisterRequested] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"request" | "verify" | "mfa" | "done">(
    initialMode === "new-password" ? "mfa" : "request"
  );

  const [identifier, setIdentifier] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [regName, setRegName] = useState("");
  const [regNim, setRegNim] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [gisReady, setGisReady] = useState(false);

  const alertRef = useRef<HTMLDivElement>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef<string>("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const handleGoogleCredential = useCallback(async (res: GoogleCredentialResponse) => {
    if (!res.credential) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: res.credential,
          ...(nonceRef.current ? { nonce: nonceRef.current } : {}),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Masuk dengan Google gagal.");
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Masuk dengan Google gagal.");
      setBusy(false);
    }
  }, []);

  const showGoogleSection = mode === "password" || mode === "otp" || mode === "register";
  const showMainTabs = showGoogleSection;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !showGoogleSection) return;
    let cancelled = false;

    const renderGis = async () => {
      const g = window.google?.accounts?.id;
      const host = googleBtnRef.current;
      if (!g || !host || cancelled) return;
      const { raw, hashed } = await createNoncePair();
      if (cancelled) return;
      nonceRef.current = raw;
      g.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: hashed,
        callback: (r) => void handleGoogleCredential(r),
      });
      host.innerHTML = "";
      const targetWidth = Math.max(240, Math.min(380, Math.floor(host.clientWidth || 340)));
      g.renderButton(host, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: targetWidth,
        locale: "id",
      });
      setGisReady(true);
    };

    if (window.google?.accounts?.id) {
      void renderGis();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => void renderGis(), { once: true });
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => void renderGis();
    script.onerror = () => setGisReady(false);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [handleGoogleCredential, showGoogleSection, device]);

  const switchMode = (nextMode: AuthMode) => {
    if (
      (nextMode === "otp" || nextMode === "recovery" || nextMode === "register") &&
      !otpEmail &&
      identifier.includes("@")
    ) {
      setOtpEmail(identifier.trim());
    }
    if (nextMode === "password" && !identifier && otpEmail) {
      setIdentifier(otpEmail.trim());
    }
    setMode(nextMode);
    setError("");
    setNotice("");
    setOtp("");
    setTotpCode("");
    setRequiresMfa(false);
    if (nextMode === "otp") setOtpRequested(false);
    if (nextMode === "register") setRegisterRequested(false);
    if (nextMode === "recovery") setRecoveryStep("request");
  };

  const viewKey =
    mode === "otp"
      ? `otp-${otpRequested ? "verify" : "request"}`
      : mode === "register"
        ? `register-${registerRequested ? "verify" : "request"}`
        : mode === "recovery" || mode === "new-password"
          ? `${mode}-${recoveryStep}`
          : "password";

  const slideOffset = device === "mobile" ? 6 : 10;
  const motionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: slideOffset },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -slideOffset },
        transition: { duration: 0.2, ease: EASE },
      };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Gagal masuk.");
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
      setBusy(false);
    }
  };

  const handleGoogleOAuthFallback = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: oauthErr } = await browserClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Masuk dengan Google gagal.");
      setBusy(false);
    }
  };

  const sendOtp = async (purpose: "login" | "recovery") => {
    const cleanEmail = otpEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Masukkan alamat email yang valid (contoh: nama@gmail.com).");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose }),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Gagal mengirim kode OTP.");
      setCooldown(60);
      setNotice(
        body.message ||
          "Jika akun aktif dan terdaftar, kode OTP telah dikirim ke email Anda."
      );
      if (purpose === "login") setOtpRequested(true);
      else setRecoveryStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim kode OTP.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidOtpToken(otp)) {
      setError("Masukkan kode OTP 6–10 digit dari email Anda.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "login",
          email: otpEmail.trim().toLowerCase(),
          token: otp,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Kode OTP tidak valid.");
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikasi OTP gagal.");
      setBusy(false);
    }
  };

  const requestRegisterOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setNotice("");
    const cleanEmail = otpEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Masukkan alamat email yang valid (contoh: nama@gmail.com).");
      return;
    }
    if (regPassword.length < 8) {
      setError("Kata sandi pendaftaran minimal 8 karakter.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          fullName: regName,
          nim: regNim,
          email: cleanEmail,
          password: regPassword,
        }),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Gagal mengirim OTP pendaftaran.");
      setCooldown(60);
      setRegisterRequested(true);
      setNotice(body.message || `Kode OTP 6 digit telah dikirim ke ${cleanEmail}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pendaftaran gagal.");
    } finally {
      setBusy(false);
    }
  };

  const verifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      setError("Masukkan kode OTP 6 digit dari email Anda.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          fullName: regName,
          nim: regNim,
          email: otpEmail.trim().toLowerCase(),
          password: regPassword,
          otp: otp.trim(),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Kode OTP pendaftaran tidak valid.");
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikasi pendaftaran gagal.");
      setBusy(false);
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi baru tidak sama.");
      return;
    }
    const useExistingSession = mode === "new-password" || recoveryStep === "mfa";
    if (!useExistingSession && !isValidOtpToken(otp)) {
      setError("Masukkan kode OTP 6–10 digit dari email Anda.");
      return;
    }
    if (requiresMfa && totpCode.length !== 6) {
      setError("Masukkan kode 6 digit dari aplikasi Authenticator (TOTP).");
      return;
    }

    setBusy(true);
    try {
      const payload = useExistingSession
        ? {
            purpose: "complete-recovery",
            password: newPassword,
            ...(totpCode ? { totpCode } : {}),
          }
        : {
            purpose: "recovery",
            email: otpEmail.trim().toLowerCase(),
            token: otp,
            password: newPassword,
            ...(totpCode ? { totpCode } : {}),
          };

      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        requiresMfa?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Pengaturan ulang sandi gagal.");

      if (body.requiresMfa) {
        setRequiresMfa(true);
        setRecoveryStep("mfa");
        setNotice(
          body.message ||
            "Masukkan kode 6 digit dari aplikasi Authenticator (TOTP) Anda."
        );
        setBusy(false);
        return;
      }

      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setTotpCode("");
      setRequiresMfa(false);
      setMode("recovery");
      setRecoveryStep("done");
      setNotice("Kata sandi berhasil diperbarui. Silakan masuk dengan sandi baru Anda.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pengaturan ulang sandi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const heading =
    mode === "otp"
      ? "Masuk dengan OTP"
      : mode === "register"
        ? "Daftar Akun Mahasiswa"
        : mode === "recovery" || mode === "new-password"
          ? "Atur ulang kata sandi"
          : "Selamat datang";

  const subtitle =
    mode === "otp"
      ? "Masukkan email yang terdaftar pada akun Anda untuk menerima kode OTP 6 digit."
      : mode === "register"
        ? "Daftarkan akun mahasiswa baru menggunakan Email, NIM, dan verifikasi OTP email."
        : mode === "recovery"
          ? "Masukkan email terdaftar Anda untuk menerima kode OTP pemulihan dan membuat sandi baru."
          : mode === "new-password"
            ? "Tautan pemulihan terverifikasi. Buat kata sandi baru minimal 8 karakter."
            : "Masuk dengan NIM, NIDN, atau email terdaftar — dosen awal memakai NIDN sebagai sandi.";

  return (
    <LazyMotion features={domAnimation} strict>
      <div className={`login-page auth-device-${device}`}>
        <aside className="login-side" aria-label="Identitas Portal NEXUS OBE">
          <div className="brand" style={{ padding: 0, border: 0 }}>
            <div className="brand-mark">N</div>
            <div className="brand-words">
              NEXUS OBE<small style={{ color: "#eed0d0" }}>ACADEMIC PORTAL</small>
            </div>
          </div>

          <div className="login-side-copy">
            <span className="hero-brow">FAKULTAS TEKNIK</span>
            <h1>Satu portal untuk seluruh perjalanan akademik.</h1>
            <p>
              Jadwal, pertemuan, tugas, presensi, evaluasi OBE, dan kabar kelas dalam
              satu tempat.
            </p>
          </div>

          <div className="login-side-foot">
            © 2026 NEXUS OBE · Akses akun kampus
          </div>
        </aside>

        <main className="login-main">
          <m.section
            layout={!reducedMotion}
            className="auth-card"
            aria-label="Autentikasi Portal NEXUS OBE"
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <div className="auth-card-top">
              <div className="kicker" style={{ marginBottom: 4 }}>
                <i
                  className={`bi ${
                    mode === "register"
                      ? "bi-person-plus-fill"
                      : showMainTabs
                        ? "bi-shield-check"
                        : "bi-key-fill"
                  }`}
                />
                {mode === "register"
                  ? "PENDAFTARAN BARU"
                  : showMainTabs
                    ? "AKUN TERDAFTAR"
                    : "PEMULIHAN AKUN"}
              </div>
              {!showMainTabs && (
                <button
                  type="button"
                  className="auth-back"
                  onClick={() => switchMode("password")}
                >
                  <i className="bi bi-arrow-left" /> Kembali ke masuk
                </button>
              )}
            </div>

            <h2>{heading}</h2>
            <p className="auth-subtitle">{subtitle}</p>

            {showMainTabs && (
              <div className="auth-tabs auth-tabs-3" role="tablist" aria-label="Metode autentikasi">
                {(
                  [
                    ["password", "Masuk", "bi-key"],
                    ["otp", "OTP Email", "bi-envelope-check"],
                    ["register", "Daftar", "bi-person-plus"],
                  ] as const
                ).map(([key, label, icon]) => {
                  const selected = mode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={`auth-tab ${selected ? "selected" : ""}`}
                      onClick={() => switchMode(key)}
                    >
                      {selected && (
                        <m.span
                          layoutId={reducedMotion ? undefined : "auth-mode-pill"}
                          className="auth-tab-pill"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="auth-tab-label">
                        <i className={`bi ${icon}`} aria-hidden="true" />
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <AnimatePresence initial={false}>
              {error && (
                <m.div
                  key="auth-error"
                  ref={alertRef}
                  tabIndex={-1}
                  className="feedback error"
                  role="alert"
                  initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />{" "}
                  <span>{error}</span>
                </m.div>
              )}
              {notice && !error && (
                <m.div
                  key="auth-notice"
                  className="feedback"
                  role="status"
                  initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />{" "}
                  <span>{notice}</span>
                </m.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              {mode === "password" && (
                <m.form
                  key={viewKey}
                  onSubmit={handlePasswordLogin}
                  className="auth-form-body"
                  {...motionProps}
                >
                  <div className="field">
                    <label htmlFor="auth-identifier">NIM, NIDN, atau Email</label>
                    <div className="input-icon-wrap">
                      <i className="bi bi-person-badge input-lead-icon" aria-hidden="true" />
                      <input
                        id="auth-identifier"
                        className="input input-with-lead"
                        type="text"
                        placeholder="240511088 / 0421117105 / nama@gmail.com"
                        autoComplete="username"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <div className="auth-label-row">
                      <label htmlFor="auth-password">Kata sandi</label>
                      <button
                        type="button"
                        className="auth-inline-link"
                        onClick={() => switchMode("recovery")}
                      >
                        Lupa kata sandi?
                      </button>
                    </div>
                    <div className="pw-wrap input-icon-wrap">
                      <i className="bi bi-lock input-lead-icon" aria-hidden="true" />
                      <input
                        id="auth-password"
                        className="input input-with-lead pw-input"
                        type={showPassword ? "text" : "password"}
                        placeholder="Masukkan kata sandi"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                      >
                        <i className={`bi bi-eye${showPassword ? "-slash" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                  >
                    {busy ? "Memproses..." : "Masuk"}
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </m.button>
                </m.form>
              )}

              {mode === "otp" && !otpRequested && (
                <m.form
                  key={viewKey}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendOtp("login");
                  }}
                  className="auth-form-body"
                  {...motionProps}
                >
                  <div className="field">
                    <label htmlFor="otp-email">Email terdaftar</label>
                    <div className="input-icon-wrap">
                      <i className="bi bi-envelope-at input-lead-icon" aria-hidden="true" />
                      <input
                        id="otp-email"
                        className="input input-with-lead"
                        type="email"
                        placeholder="nama@gmail.com"
                        autoComplete="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                      />
                    </div>
                    <span className="field-hint">
                      Dosen yang masuk pertama kali pakai NIDN dapat menambahkan email
                      pribadi di menu Pengaturan terlebih dahulu.
                    </span>
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                  >
                    {busy ? "Mengirim OTP..." : "Kirim Kode OTP ke Email"}
                    <i className="bi bi-send" aria-hidden="true" />
                  </m.button>
                </m.form>
              )}

              {mode === "otp" && otpRequested && (
                <m.form
                  key={viewKey}
                  onSubmit={verifyOtpLogin}
                  className="auth-form-body"
                  {...motionProps}
                >
                  <div className="field">
                    <label htmlFor="login-otp-code">Kode OTP dari email</label>
                    <input
                      id="login-otp-code"
                      className="input otp-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      minLength={6}
                      maxLength={10}
                      required
                      value={otp}
                      onChange={(e) => setOtp(cleanOtpToken(e.target.value))}
                    />
                    <span className="field-hint">
                      Periksa email <strong>{otpEmail.trim().toLowerCase()}</strong>{" "}
                      (termasuk folder spam).
                    </span>
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                  >
                    {busy ? "Memverifikasi..." : "Verifikasi OTP & Masuk"}
                    <i className="bi bi-shield-check" aria-hidden="true" />
                  </m.button>

                  <div className="auth-subactions">
                    <button
                      type="button"
                      className="auth-inline-link"
                      disabled={busy || cooldown > 0}
                      onClick={() => void sendOtp("login")}
                    >
                      {cooldown > 0 ? `Kirim ulang (${cooldown}d)` : "Kirim ulang kode OTP"}
                    </button>
                    <button
                      type="button"
                      className="auth-inline-link muted"
                      disabled={busy}
                      onClick={() => {
                        setOtpRequested(false);
                        setOtp("");
                        setError("");
                      }}
                    >
                      Ganti alamat email
                    </button>
                  </div>
                </m.form>
              )}

              {mode === "register" && !registerRequested && (
                <m.form
                  key={viewKey}
                  onSubmit={(e) => void requestRegisterOtp(e)}
                  className="auth-form-body"
                  {...motionProps}
                >
                  <div className="field">
                    <label htmlFor="reg-fullname">Nama lengkap</label>
                    <div className="input-icon-wrap">
                      <i className="bi bi-person input-lead-icon" aria-hidden="true" />
                      <input
                        id="reg-fullname"
                        className="input input-with-lead"
                        type="text"
                        placeholder="Nama lengkap sesuai data kampus"
                        autoComplete="name"
                        minLength={3}
                        maxLength={150}
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="reg-nim">NIM Mahasiswa</label>
                    <div className="input-icon-wrap">
                      <i className="bi bi-card-heading input-lead-icon" aria-hidden="true" />
                      <input
                        id="reg-nim"
                        className="input input-with-lead"
                        type="text"
                        placeholder="Contoh: 240511088"
                        minLength={4}
                        maxLength={30}
                        required
                        value={regNim}
                        onChange={(e) => setRegNim(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="reg-email">Email pribadi / Gmail</label>
                    <div className="input-icon-wrap">
                      <i className="bi bi-envelope-at input-lead-icon" aria-hidden="true" />
                      <input
                        id="reg-email"
                        className="input input-with-lead"
                        type="email"
                        placeholder="nama@gmail.com"
                        autoComplete="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <PasswordStrengthInput
                    id="reg-password"
                    label="Buat kata sandi (minimal 8 karakter)"
                    value={regPassword}
                    onChange={setRegPassword}
                  />

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                  >
                    {busy ? "Mengirim OTP..." : "Kirim OTP Pendaftaran ke Email"}
                    <i className="bi bi-envelope-check" aria-hidden="true" />
                  </m.button>
                </m.form>
              )}

              {mode === "register" && registerRequested && (
                <m.form
                  key={viewKey}
                  onSubmit={verifyRegisterOtp}
                  className="auth-form-body"
                  {...motionProps}
                >
                  <div className="field">
                    <label htmlFor="reg-otp-code">Kode OTP 6 digit dari email</label>
                    <input
                      id="reg-otp-code"
                      className="input otp-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      minLength={6}
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(cleanOtpToken(e.target.value).slice(0, 6))}
                    />
                    <span className="field-hint">
                      Masukkan kode OTP yang dikirim ke{" "}
                      <strong>{otpEmail.trim().toLowerCase()}</strong> untuk NIM{" "}
                      <strong>{regNim.trim()}</strong>.
                    </span>
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                  >
                    {busy ? "Mengaktifkan akun..." : "Verifikasi OTP & Selesaikan Daftar"}
                    <i className="bi bi-check2-circle" aria-hidden="true" />
                  </m.button>

                  <div className="auth-subactions">
                    <button
                      type="button"
                      className="auth-inline-link"
                      disabled={busy || cooldown > 0}
                      onClick={() => void requestRegisterOtp()}
                    >
                      {cooldown > 0 ? `Kirim ulang (${cooldown}d)` : "Kirim ulang kode OTP"}
                    </button>
                    <button
                      type="button"
                      className="auth-inline-link muted"
                      disabled={busy}
                      onClick={() => {
                        setRegisterRequested(false);
                        setOtp("");
                        setError("");
                      }}
                    >
                      Ubah data pendaftaran
                    </button>
                  </div>
                </m.form>
              )}

              {mode === "recovery" && recoveryStep === "request" && (
                <m.form
                  key={viewKey}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendOtp("recovery");
                  }}
                  className="auth-form-body"
                  {...motionProps}
                >
                  <div className="field">
                    <label htmlFor="recovery-email">Email terdaftar</label>
                    <div className="input-icon-wrap">
                      <i className="bi bi-envelope-at input-lead-icon" aria-hidden="true" />
                      <input
                        id="recovery-email"
                        className="input input-with-lead"
                        type="email"
                        placeholder="nama@gmail.com"
                        autoComplete="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                  >
                    {busy ? "Mengirim OTP..." : "Kirim OTP Pemulihan"}
                    <i className="bi bi-envelope-arrow-up" aria-hidden="true" />
                  </m.button>
                </m.form>
              )}

              {(mode === "recovery" || mode === "new-password") &&
                (recoveryStep === "verify" || recoveryStep === "mfa") && (
                  <m.form
                    key={viewKey}
                    onSubmit={submitRecovery}
                    className="auth-form-body"
                    {...motionProps}
                  >
                    {mode === "recovery" && recoveryStep === "verify" && (
                      <div className="field">
                        <label htmlFor="recovery-otp">Kode OTP dari email</label>
                        <input
                          id="recovery-otp"
                          className="input otp-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          minLength={6}
                          maxLength={10}
                          required
                          value={otp}
                          onChange={(e) => setOtp(cleanOtpToken(e.target.value))}
                        />
                      </div>
                    )}

                    <PasswordStrengthInput
                      id="recovery-new-password"
                      label="Kata sandi baru (minimal 8 karakter)"
                      value={newPassword}
                      onChange={setNewPassword}
                    />

                    <div className="field">
                      <label htmlFor="recovery-confirm-password">Ulangi kata sandi baru</label>
                      <input
                        id="recovery-confirm-password"
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    {requiresMfa && (
                      <div className="field">
                        <label htmlFor="recovery-totp">Kode Authenticator (TOTP)</label>
                        <input
                          id="recovery-totp"
                          className="input otp-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="6 digit TOTP"
                          maxLength={6}
                          required
                          value={totpCode}
                          onChange={(e) =>
                            setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                        />
                      </div>
                    )}

                    <m.button
                      type="submit"
                      className="btn btn-primary btn-full auth-submit"
                      disabled={busy}
                      whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                    >
                      {busy ? "Menyimpan sandi..." : "Verifikasi & Simpan Sandi Baru"}
                      <i className="bi bi-check2-circle" aria-hidden="true" />
                    </m.button>

                    {mode === "recovery" && recoveryStep === "verify" && (
                      <div className="auth-subactions">
                        <button
                          type="button"
                          className="auth-inline-link"
                          disabled={busy || cooldown > 0}
                          onClick={() => void sendOtp("recovery")}
                        >
                          {cooldown > 0 ? `Kirim ulang (${cooldown}d)` : "Kirim ulang kode"}
                        </button>
                        <button
                          type="button"
                          className="auth-inline-link muted"
                          disabled={busy}
                          onClick={() => setRecoveryStep("request")}
                        >
                          Ubah alamat email
                        </button>
                      </div>
                    )}
                  </m.form>
                )}

              {mode === "recovery" && recoveryStep === "done" && (
                <m.div key={viewKey} className="auth-form-body" {...motionProps}>
                  <m.button
                    type="button"
                    className="btn btn-primary btn-full auth-submit"
                    onClick={() => switchMode("password")}
                    whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                  >
                    Masuk dengan Kata Sandi Baru
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </m.button>
                </m.div>
              )}
            </AnimatePresence>

            {showGoogleSection && (
              <>
                <div className="auth-divider">
                  <span />
                  <em>atau lanjutkan dengan</em>
                  <span />
                </div>

                {GOOGLE_CLIENT_ID && (
                  <div
                    ref={googleBtnRef}
                    className={`google-gis-host ${gisReady ? "ready" : ""}`}
                  />
                )}

                {(!GOOGLE_CLIENT_ID || !gisReady) && (
                  <m.button
                    type="button"
                    className="btn btn-google btn-full"
                    onClick={handleGoogleOAuthFallback}
                    disabled={busy}
                    whileTap={reducedMotion || busy ? undefined : { scale: 0.985 }}
                  >
                    <GoogleMark />
                    Lanjutkan dengan Google
                  </m.button>
                )}

                <p className="field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
                  Gunakan akun Google dengan email yang terdaftar pada portal kampus.
                </p>
              </>
            )}
          </m.section>
        </main>
      </div>
    </LazyMotion>
  );
}
