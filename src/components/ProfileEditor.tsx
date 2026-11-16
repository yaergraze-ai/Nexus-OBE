"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { compressAvatarImage } from "@/lib/utils/image-compressor";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0])
    .join("")
    .toUpperCase();
}

export function ProfileEditor({
  initialName,
  initialAvatarUrl = null,
}: {
  initialName: string;
  initialAvatarUrl?: string | null;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [savedAvatar, setSavedAvatar] = useState<string | null>(initialAvatarUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFile = (file: File | null) => {
    if (!file) return;
    setMessage("");
    setIsError(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const displayUrl = previewUrl ?? savedAvatar;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Perubahan gagal");

      if (pendingFile) {
        const compressed = await compressAvatarImage(pendingFile);
        const form = new FormData();
        form.set("photo", compressed);
        const uploaded = await fetch("/api/profile/avatar", { method: "POST", body: form });
        const uploadJson = (await uploaded.json()) as { error?: string; signedUrl?: string | null };
        if (!uploaded.ok) throw new Error(uploadJson.error || "Upload foto gagal");
        if (uploadJson.signedUrl) setSavedAvatar(uploadJson.signedUrl);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPendingFile(null);
      }

      setMessage("Profil dan foto berhasil disimpan.");
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan profil.");
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingFile(null);
      return;
    }
    if (!savedAvatar) return;
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal menghapus foto.");
      setSavedAvatar(null);
      setMessage("Foto profil dihapus.");
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Gagal menghapus foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <form onSubmit={save} className="stack">
        <div
          className={`avatar-dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <button
            type="button"
            className="avatar-picker-btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Pilih atau ubah foto profil"
          >
            <AnimatePresence mode="wait" initial={false}>
              {displayUrl ? (
                <m.img
                  key={displayUrl}
                  src={displayUrl}
                  alt="Pratinjau foto profil"
                  className="avatar-preview-img"
                  initial={reduced ? false : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.18 }}
                />
              ) : (
                <m.span
                  key="initials"
                  className="avatar-preview-fallback"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {initials(name || initialName)}
                </m.span>
              )}
            </AnimatePresence>
            <span className="avatar-camera-badge" aria-hidden="true">
              <i className="bi bi-camera-fill" />
            </span>
          </button>

          <div className="avatar-dropzone-copy">
            <strong>Foto Profil (PP)</strong>
            <p className="tiny subtle" style={{ margin: "2px 0 8px" }}>
              Klik foto atau seret gambar ke sini. Otomatis dipotong persegi &amp; dikompresi
              ke WebP (maks. 500 KB).
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <i className="bi bi-image" /> {displayUrl ? "Ganti Foto" : "Pilih Foto"}
              </button>
              {displayUrl && (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  disabled={busy}
                  onClick={() => void removeAvatar()}
                >
                  <i className="bi bi-trash" /> {previewUrl ? "Batalkan" : "Hapus PP"}
                </button>
              )}
            </div>
            {pendingFile && (
              <span className="tiny" style={{ display: "block", marginTop: 6, color: "#0369a1" }}>
                Foto baru siap disimpan: {pendingFile.name}
              </span>
            )}
          </div>

          <input
            ref={inputRef}
            id="profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            style={{ display: "none" }}
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="full_name">Nama tampilan</label>
          <input
            id="full_name"
            className="input"
            value={name}
            minLength={3}
            maxLength={150}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" disabled={busy}>
          <i className="bi bi-check2-circle" />{" "}
          {busy ? "Menyimpan perubahan..." : "Simpan Profil & PP"}
        </button>

        {message && (
          <div className={`feedback ${isError ? "error" : ""}`} role="status" style={{ margin: 0 }}>
            {message}
          </div>
        )}
      </form>
    </LazyMotion>
  );
}
