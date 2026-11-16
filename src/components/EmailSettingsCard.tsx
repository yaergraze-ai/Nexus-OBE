"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanOtpToken, isValidOtpToken } from "@/lib/auth-helpers";

export function EmailSettingsCard({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"idle" | "otp">("idle");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const requestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage("");
    setIsError(false);
    setBusy(true);
    try {
      const res = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", newEmail }),
      });
      const body = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Gagal mengirim OTP email.");
      setStep("otp");
      setCooldown(60);
      setMessage(
        body.message || `Kode OTP dikirim ke ${newEmail.trim().toLowerCase()}.`
      );
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Gagal mengirim OTP.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    if (!isValidOtpToken(otp)) {
      setIsError(true);
      return setMessage("Masukkan kode OTP 6–10 digit dari email baru Anda.");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", newEmail, token: otp }),
      });
      const body = (await res.json()) as { email?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Kode OTP tidak valid.");
      setStep("idle");
      setNewEmail("");
      setOtp("");
      setMessage(
        `Email berhasil diperbarui menjadi ${body.email || newEmail}. Kini Anda bisa login memakai OTP Email maupun Google dengan email tersebut.`
      );
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Verifikasi OTP gagal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="email-settings-title">
      <div className="panelhead">
        <h2 id="email-settings-title">Email Pribadi &amp; Verifikasi OTP</h2>
        <span className="tag blue">OTP &amp; Google Login</span>
      </div>
      <p className="subtle">
        Tambahkan atau perbarui email pribadi Anda (mis. Gmail) melalui kode OTP
        agar dapat masuk memakai Google maupun OTP Email.
      </p>

      <div className="stat-line" style={{ marginBottom: 16 }}>
        <span>Email aktif saat ini</span>
        <strong>{currentEmail}</strong>
      </div>

      {step === "idle" ? (
        <form onSubmit={requestOtp} className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="settings-new-email">Email pribadi / Gmail baru</label>
            <input
              id="settings-new-email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="nama@gmail.com"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button className="btn btn-primary" disabled={busy}>
              <i className="bi bi-envelope-check" />{" "}
              {busy ? "Mengirim OTP..." : "Kirim Kode OTP ke Email"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="settings-email-otp">
              Kode OTP yang masuk ke {newEmail.trim().toLowerCase()}
            </label>
            <input
              id="settings-email-otp"
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
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Memverifikasi..." : "Verifikasi OTP & Simpan Email"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || cooldown > 0}
              onClick={() => void requestOtp()}
            >
              {cooldown > 0 ? `Kirim ulang (${cooldown}d)` : "Kirim ulang OTP"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                setStep("idle");
                setOtp("");
              }}
            >
              Ganti email
            </button>
          </div>
        </form>
      )}

      {message && (
        <div
          className={`feedback ${isError ? "error" : ""}`}
          role="status"
          style={{ marginTop: 14, marginBottom: 0 }}
        >
          {message}
        </div>
      )}
    </section>
  );
}
