"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { PasswordStrengthInput } from "@/components/PasswordStrengthInput";

export function LecturerPasswordCard({
  identityNumber,
  needsMfa = false,
}: {
  identityNumber: string;
  needsMfa?: boolean;
}) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requireTotp, setRequireTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      return setError("Kata sandi baru minimal 8 karakter.");
    }
    if (password.trim().toLowerCase() === identityNumber.trim().toLowerCase()) {
      return setError("Kata sandi baru tidak boleh sama dengan NIDN.");
    }
    if (password !== confirm) {
      return setError("Konfirmasi kata sandi tidak sama.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(totpCode ? { totpCode } : {}),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        requiresMfa?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Gagal menyimpan kata sandi.");

      if (body.requiresMfa) {
        setRequireTotp(true);
        setError(
          body.message ||
          "Masukkan kode 6 digit Authenticator (TOTP) untuk mengonfirmasi."
        );
        return;
      }

      setDone(true);
      setPassword("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui kata sandi."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <m.section
        className="panel dosen-password-card"
        aria-labelledby="dosen-pw-heading"
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="panelhead" style={{ marginBottom: 12 }}>
          <div>
            <span className="kicker" style={{ marginBottom: 4 }}>
              <i className="bi bi-shield-exclamation" /> KEAMANAN AKUN DOSEN
            </span>
            <h2 id="dosen-pw-heading">Ubah Kata Sandi Awal (NIDN)</h2>
          </div>
          <span className={`tag ${done ? "good" : "warn"}`}>
            {done ? "Sandi Diperbarui" : "Wajib Diganti"}
          </span>
        </div>

        {done ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="feedback" role="status" style={{ margin: 0 }}>
              <i className="bi bi-check-circle-fill" /> Kata sandi baru Anda sudah
              aktif. Selanjutnya gunakan kata sandi baru (atau email/Google) untuk
              masuk.
            </div>
            <div className="form-actions" style={{ marginTop: 0 }}>
              <Link href="/pengaturan/keamanan" className="btn btn-primary">
                <i className="bi bi-envelope-check" />{" "}
                {needsMfa
                  ? "Atur Email Pribadi (OTP) & Verifikasi MFA"
                  : "Tambah / Ubah Email Pribadi (OTP)"}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="subtle" style={{ marginBottom: 16 }}>
              Anda masuk memakai kata sandi awal yang sama dengan NIDN (
              <strong>{identityNumber}</strong>). Buat kata sandi baru yang kuat
              minimal 8 karakter sebelum mengelola pertemuan dan nilai.
            </p>

            {error && (
              <div className="feedback error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="dosen-pw-form">
              <div className="form-grid">
                <PasswordStrengthInput
                  id="dosen-new-pw"
                  label="Kata sandi baru (minimal 8 karakter)"
                  value={password}
                  onChange={setPassword}
                  placeholder="Contoh: Dosen@2026!"
                />
                <div className="field">
                  <label htmlFor="dosen-confirm-pw">Konfirmasi kata sandi baru</label>
                  <input
                    id="dosen-confirm-pw"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    placeholder="Ketik ulang kata sandi baru"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  {confirm && confirm !== password && (
                    <span className="field-hint" style={{ color: "#b91c1c" }}>
                      Konfirmasi belum cocok dengan kata sandi baru.
                    </span>
                  )}
                </div>
              </div>

              {requireTotp && (
                <div className="field" style={{ maxWidth: 260, marginTop: 12 }}>
                  <label htmlFor="dosen-totp">Kode Authenticator (TOTP)</label>
                  <input
                    id="dosen-totp"
                    className="input otp-input"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </div>
              )}

              <div className="form-actions">
                <button className="btn btn-primary" disabled={busy}>
                  <i className="bi bi-check2-circle" />
                  {busy ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
                </button>
                <Link href="/pengaturan/keamanan" className="btn btn-secondary">
                  <i className="bi bi-shield-lock" /> Pengaturan Keamanan & MFA
                </Link>
              </div>
            </form>
          </>
        )}
      </m.section>
    </LazyMotion>
  );
}

