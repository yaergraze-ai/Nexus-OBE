"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { browserClient } from "@/lib/supabase/browser";
import {
  cleanOtpToken,
  isValidIdentifier,
  isValidOtpToken,
  type AuthMode,
} from "@/lib/auth-helpers";

interface LoginFormProps {
  initialMode?: AuthMode;
  initialError?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

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

export function LoginForm({
  initialMode = "password",
  initialError = "",
}: LoginFormProps) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [otpRequested, setOtpRequested] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"request" | "verify" | "mfa" | "done">(
    initialMode === "new-password" ? "mfa" : "request"
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
    setOtp("");
    setTotpCode("");
    setRequiresMfa(false);
    if (nextMode === "otp") setOtpRequested(false);
    if (nextMode === "recovery") setRecoveryStep("request");
  };

  const viewKey =
    mode === "otp"
      ? `otp-${otpRequested ? "verify" : "request"}`
      : mode === "recovery" || mode === "new-password"
        ? `${mode}-${recoveryStep}`
        : "password";

  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
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

  const handleGoogleLogin = async () => {
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
    if (!isValidIdentifier(identifier)) {
      setError("Masukkan email kampus atau nomor induk dosen/staf yang valid.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, purpose }),
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
        body: JSON.stringify({ purpose: "login", identifier, token: otp }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Kode OTP tidak valid.");
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikasi OTP gagal.");
      setBusy(false);
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 12) {
      setError("Kata sandi baru minimal 12 karakter.");
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
            identifier,
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

  const isLoginMode = mode === "password" || mode === "otp";

  const heading =
    mode === "otp"
      ? "Masuk dengan OTP"
      : mode === "recovery" || mode === "new-password"
        ? "Atur ulang kata sandi"
        : "Selamat datang";

  const subtitle =
    mode === "otp"
      ? "Kode OTP 6 digit dikirim langsung ke email akun yang Anda pakai untuk masuk."
      : mode === "recovery"
        ? "Verifikasi email akun Anda dengan OTP lalu buat kata sandi baru tanpa meninggalkan halaman ini."
        : mode === "new-password"
          ? "Tautan pemulihan terverifikasi. Buat kata sandi baru untuk akun Anda."
          : "Mahasiswa masuk dengan email; dosen dan staf dapat menggunakan NIDN/nomor induk atau email.";

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="login-page">
        <m.div
          className="login-side"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="brand" style={{ padding: 0, border: 0 }}>
            <div className="brand-mark">N</div>
            <div className="brand-words">
              NEXUS OBE<small style={{ color: "#eed0d0" }}>ACADEMIC PORTAL</small>
            </div>
          </div>

          <m.div
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: EASE }}
          >
            <span className="hero-brow">FAKULTAS TEKNIK</span>
            <h1>Satu portal untuk seluruh perjalanan akademik.</h1>
            <p>
              Jadwal, pertemuan, tugas, presensi, evaluasi OBE, dan kabar kelas dalam satu
              tempat.
            </p>
          </m.div>

          <div style={{ fontSize: 11, color: "#e5bdc0" }}>
            © 2026 NEXUS OBE · Portal Akademik Terintegrasi
          </div>
        </m.div>

        <main className="login-main">
          <m.section
            className="auth-card"
            aria-label="Autentikasi Portal NEXUS OBE"
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <div className="auth-card-top">
              <div className="kicker" style={{ marginBottom: 6 }}>
                <i className={`bi ${isLoginMode ? "bi-shield-check" : "bi-key-fill"}`} />
                {isLoginMode ? "AKUN TERDAFTAR" : "PEMULIHAN AKUN"}
              </div>
              {!isLoginMode && (
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

            {isLoginMode && (
              <div className="auth-tabs" role="tablist" aria-label="Metode masuk">
                {(
                  [
                    ["password", "Kata Sandi", "bi-key"],
                    ["otp", "OTP Email", "bi-envelope-check"],
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
                          layoutId={reduced ? undefined : "auth-mode-pill"}
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
                  initial={reduced ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -4 }}
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
                  initial={reduced ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -4 }}
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
                    <label htmlFor="auth-identifier">Email atau nomor induk dosen/staf</label>
                    <input
                      id="auth-identifier"
                      className="input"
                      type="text"
                      placeholder="nama@hananuttt.my.id / 0421117105"
                      autoComplete="username"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
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
                    <div className="pw-wrap">
                      <input
                        id="auth-password"
                        className="input pw-input"
                        type={showPassword ? "text" : "password"}
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
                    whileTap={reduced || busy ? undefined : { scale: 0.985 }}
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
                    <label htmlFor="otp-identifier">Email terdaftar atau NIDN dosen/staf</label>
                    <input
                      id="otp-identifier"
                      className="input"
                      type="text"
                      placeholder="nama@hananuttt.my.id / 0421117105"
                      autoComplete="username"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
                    <span className="field-hint">
                      OTP hanya dikirim ke email resmi yang terdaftar pada akun tersebut.
                    </span>
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reduced || busy ? undefined : { scale: 0.985 }}
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
                      Masukkan kode 6–8 digit yang masuk ke email akun{" "}
                      <strong>{identifier.includes("@") ? identifier : "terdaftar"}</strong>.
                    </span>
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reduced || busy ? undefined : { scale: 0.985 }}
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
                      Ganti email / NIDN
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
                    <label htmlFor="recovery-identifier">Email terdaftar atau NIDN dosen/staf</label>
                    <input
                      id="recovery-identifier"
                      className="input"
                      type="text"
                      placeholder="nama@hananuttt.my.id / 0421117105"
                      autoComplete="email"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
                  </div>

                  <m.button
                    type="submit"
                    className="btn btn-primary btn-full auth-submit"
                    disabled={busy}
                    whileTap={reduced || busy ? undefined : { scale: 0.985 }}
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

                    <div className="field">
                      <label htmlFor="recovery-new-password">
                        Kata sandi baru (minimal 12 karakter)
                      </label>
                      <div className="pw-wrap">
                        <input
                          id="recovery-new-password"
                          className="input pw-input"
                          type={showNewPassword ? "text" : "password"}
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="pw-toggle"
                          onClick={() => setShowNewPassword((v) => !v)}
                          aria-label={
                            showNewPassword ? "Sembunyikan sandi" : "Tampilkan sandi"
                          }
                        >
                          <i className={`bi bi-eye${showNewPassword ? "-slash" : ""}`} />
                        </button>
                      </div>
                      <span className="field-hint">
                        Panjang saat ini: {newPassword.length}/12+ karakter
                      </span>
                    </div>

                    <div className="field">
                      <label htmlFor="recovery-confirm-password">Ulangi kata sandi baru</label>
                      <input
                        id="recovery-confirm-password"
                        className="input"
                        type={showNewPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={12}
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
                      whileTap={reduced || busy ? undefined : { scale: 0.985 }}
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
                          Ubah email / NIDN
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
                    whileTap={reduced ? undefined : { scale: 0.985 }}
                  >
                    Masuk dengan Kata Sandi Baru
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </m.button>
                </m.div>
              )}
            </AnimatePresence>

            {isLoginMode && (
              <>
                <div className="auth-divider">
                  <span />
                  <em>atau lanjutkan dengan</em>
                  <span />
                </div>

                <m.button
                  type="button"
                  className="btn btn-google btn-full"
                  onClick={handleGoogleLogin}
                  disabled={busy}
                  whileTap={reduced || busy ? undefined : { scale: 0.985 }}
                >
                  <GoogleMark />
                  Lanjutkan dengan Google
                </m.button>

                <p className="field-hint" style={{ marginTop: 14, marginBottom: 0 }}>
                  Hanya email Google yang terdaftar pada akun kampus yang diizinkan. Tidak ada
                  pendaftaran otomatis.
                </p>
              </>
            )}
          </m.section>
        </main>
      </div>
    </LazyMotion>
  );
}
