"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { PasswordStrengthInput } from "@/components/PasswordStrengthInput";

export function AccountSecurity() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    void browserClient()
      .auth.getUserIdentities()
      .then(({ data }) =>
        setLinked(Boolean(data?.identities?.some((i) => i.provider === "google")))
      );
  }, []);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    if (password.length < 8) {
      setIsError(true);
      return setMessage("Kata sandi minimal 8 karakter.");
    }
    if (password !== confirm) {
      setIsError(true);
      return setMessage("Konfirmasi kata sandi berbeda.");
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
      if (!res.ok) throw new Error(body.error || "Gagal memperbarui kata sandi.");
      if (body.requiresMfa) {
        setNeedsMfa(true);
        setMessage(
          body.message || "Masukkan kode 6 digit Authenticator (TOTP) untuk melanjutkan."
        );
        return;
      }
      setPassword("");
      setConfirm("");
      setTotpCode("");
      setNeedsMfa(false);
      setMessage("Kata sandi baru berhasil disimpan.");
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error ? e.message : "Gagal memperbarui kata sandi."
      );
    } finally {
      setBusy(false);
    }
  };

  const link = async () => {
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const {
        data: { user },
      } = await browserClient().auth.getUser();
      if (!user?.email_confirmed_at) throw new Error("Email belum diverifikasi.");
      const { error } = await browserClient().auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
            "/pengaturan/keamanan"
          )}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error ? e.message : "Tidak bisa menghubungkan Google."
      );
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panelhead">
        <h2>Google dan kata sandi</h2>
      </div>
      <p className="subtle">
        Satu akun kampus, bisa masuk via NIM/NIDN/Email atau akun Google dengan
        email terdaftar yang sama.
      </p>
      <div className="notice" style={{ marginBottom: 20 }}>
        {linked
          ? "Google sudah terhubung ke akun ini."
          : "Google belum terhubung. Aktifkan manual identity linking pada Supabase atau masuk Google memakai email yang sama."}
      </div>
      {!linked && (
        <button className="btn btn-secondary" onClick={link} disabled={busy}>
          <i className="bi bi-google" /> Hubungkan akun Google
        </button>
      )}
      <form onSubmit={change} className="stack" style={{ marginTop: 20 }}>
        <PasswordStrengthInput
          id="password-new"
          label="Kata sandi baru (minimal 8 karakter)"
          value={password}
          onChange={setPassword}
        />
        <div className="field">
          <label htmlFor="password-confirm">Ulangi kata sandi baru</label>
          <input
            id="password-confirm"
            className="input"
            autoComplete="new-password"
            type="password"
            minLength={8}
            maxLength={128}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {needsMfa && (
          <div className="field">
            <label htmlFor="security-totp">Kode Authenticator (TOTP)</label>
            <input
              id="security-totp"
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
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Menyimpan..." : "Ganti kata sandi"}
        </button>
      </form>
      {message && (
        <div
          className={`feedback ${isError ? "error" : ""}`}
          role="status"
          style={{ marginTop: 14 }}
        >
          {message}
        </div>
      )}
    </section>
  );
}
