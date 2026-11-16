"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { PasswordStrengthInput } from "@/components/PasswordStrengthInput";

interface GoogleCred {
  credential?: string;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";

async function createNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  return { raw, hashed };
}

export function AccountSecurity({ currentEmail = "" }: { currentEmail?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [linked, setLinked] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  const googleHostRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef("");
  const gisInitRef = useRef(false);
  const handlerRef = useRef<(r: GoogleCred) => void>(() => {});

  const isGmailLinked =
    linked || (Boolean(currentEmail) && !currentEmail.endsWith("@kampus.local"));

  useEffect(() => {
    void browserClient()
      .auth.getUserIdentities()
      .then(({ data }) =>
        setLinked(Boolean(data?.identities?.some((i) => i.provider === "google")))
      );
  }, []);

  const handleGoogleLink = useCallback(
    async (res: GoogleCred) => {
      if (!res.credential) return;
      setBusy(true);
      setMessage("");
      setIsError(false);
      try {
        const response = await fetch("/api/profile/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential: res.credential,
            ...(nonceRef.current ? { nonce: nonceRef.current } : {}),
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          message?: string;
        };
        if (!response.ok) throw new Error(body.error || "Gagal menghubungkan akun Google.");
        setLinked(true);
        setMessage(body.message || "Akun Google berhasil dihubungkan.");
        router.refresh();
      } catch (err) {
        setIsError(true);
        setMessage(err instanceof Error ? err.message : "Gagal menghubungkan akun Google.");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  useEffect(() => {
    handlerRef.current = (r) => void handleGoogleLink(r);
  }, [handleGoogleLink]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || isGmailLinked) return;
    let cancelled = false;

    const renderBtn = async () => {
      const g = (
        window as unknown as {
          google?: {
            accounts?: {
              id?: {
                initialize: (c: {
                  client_id: string;
                  nonce?: string;
                  callback: (r: GoogleCred) => void;
                }) => void;
                renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
              };
            };
          };
        }
      ).google?.accounts?.id;
      const host = googleHostRef.current;
      if (!g || !host || cancelled) return;
      if (!gisInitRef.current) {
        gisInitRef.current = true;
        const { raw, hashed } = await createNoncePair();
        if (cancelled) return;
        nonceRef.current = raw;
        g.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          callback: (r) => handlerRef.current(r),
        });
      }
      if (cancelled) return;
      host.innerHTML = "";
      g.renderButton(host, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: 280,
        locale: "id",
      });
      setGisReady(true);
    };

    if (
      (window as unknown as { google?: { accounts?: { id?: unknown } } }).google?.accounts
        ?.id
    ) {
      void renderBtn();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => void renderBtn(), { once: true });
      return () => {
        cancelled = true;
      };
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => void renderBtn();
    document.head.appendChild(s);
    return () => {
      cancelled = true;
    };
  }, [isGmailLinked]);

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

  return (
    <section className="panel">
      <div className="panelhead">
        <h2>Google dan kata sandi</h2>
      </div>
      <p className="subtle">
        Satu akun kampus bisa masuk lewat NIM/NIDN/Email maupun akun Google dengan
        email terdaftar yang sama.
      </p>
      <div className="notice" style={{ marginBottom: 16 }}>
        <i className={`bi bi-${isGmailLinked ? "check-circle-fill" : "google"}`} />
        <div>
          <strong>
            {isGmailLinked
              ? `Akun Google siap digunakan (${currentEmail || "Terhubung"})`
              : "Belum terhubung ke Gmail"}
          </strong>
          <p>
            {isGmailLinked
              ? "Anda sudah bisa langsung menekan tombol Google di halaman Masuk memakai email ini."
              : "Pilih akun Google di bawah untuk menghubungkan Gmail Anda secara langsung tanpa menunggu OAuth manual."}
          </p>
        </div>
      </div>

      {!isGmailLinked && GOOGLE_CLIENT_ID && (
        <div style={{ marginBottom: 18 }}>
          <div ref={googleHostRef} className={`google-gis-host ${gisReady ? "ready" : ""}`} />
          {!gisReady && (
            <p className="tiny subtle">Memuat tombol pilih akun Google...</p>
          )}
        </div>
      )}

      <form onSubmit={change} className="stack" style={{ marginTop: 18 }}>
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
        {message && (
          <div className={`feedback ${isError ? "error" : ""}`} role="status">
            {message}
          </div>
        )}
      </form>
    </section>
  );
}
