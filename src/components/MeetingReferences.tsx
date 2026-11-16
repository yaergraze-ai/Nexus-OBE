"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { MEETING_REF_BUCKET, MAX_REFERENCE_FILE_BYTES } from "@/lib/assignments/attachments";
import { postJson } from "@/lib/utils/request";
import type { MeetingReference } from "@/types/domain";

const ACCEPT_ATTR =
  ".pdf,.doc,.docx,.zip,.rar,.7z,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.bib,.ris";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileIcon(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "bi-file-earmark-pdf-fill";
  if (ext === "doc" || ext === "docx") return "bi-file-earmark-word-fill";
  if (ext === "zip" || ext === "rar" || ext === "7z") return "bi-file-earmark-zip-fill";
  if (ext === "ppt" || ext === "pptx") return "bi-file-earmark-slides-fill";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "bi-file-earmark-spreadsheet-fill";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "bi-file-earmark-image-fill";
  return "bi-file-earmark-text-fill";
}

async function uploadSingleReferenceFile(referenceId: string, file: File) {
  if (file.size < 1 || file.size > MAX_REFERENCE_FILE_BYTES) {
    throw new Error(`${file.name}: ukuran file maksimal 50 MB.`);
  }
  const ticket = await postJson<{
    path: string;
    token: string;
    mime: string;
  }>("/api/meetings/references/upload-url", {
    referenceId,
    fileName: file.name,
    byteSize: file.size,
  });

  const db = browserClient();
  const uploaded = await db.storage
    .from(MEETING_REF_BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, file, {
      contentType: ticket.mime,
    });
  if (uploaded.error) throw new Error(`${file.name}: ${uploaded.error.message}`);

  await postJson("/api/meetings/references/files", {
    referenceId,
    path: ticket.path,
    fileName: file.name,
    byteSize: file.size,
  });
}

export function MeetingReferences({
  meetingId,
  references,
  canManage,
}: {
  meetingId: string;
  references: MeetingReference[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [citation, setCitation] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [uploadingRefId, setUploadingRefId] = useState<string | null>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const quickTargetRef = useRef<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setCitation("");
    setReferenceUrl("");
    setNotes("");
    setQueuedFiles([]);
    setError("");
    setProgressText("");
    setOpen(true);
  };

  const openEdit = (refItem: MeetingReference) => {
    setEditingId(refItem.id);
    setTitle(refItem.title);
    setCitation(refItem.citation);
    setReferenceUrl(refItem.reference_url ?? "");
    setNotes(refItem.notes);
    setQueuedFiles([]);
    setError("");
    setProgressText("");
    setOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setProgressText("");
    try {
      const saved = await postJson<{ id: string }>("/api/meetings/references", {
        ...(editingId ? { id: editingId } : {}),
        meetingId,
        title,
        citation,
        referenceUrl: referenceUrl.trim() || null,
        notes,
      });

      const targetRefId = editingId || saved.id;
      for (let i = 0; i < queuedFiles.length; i += 1) {
        setProgressText(
          `Mengunggah berkas ${i + 1}/${queuedFiles.length}: ${queuedFiles[i].name}`
        );
        await uploadSingleReferenceFile(targetRefId, queuedFiles[i]);
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan referensi.");
    } finally {
      setBusy(false);
      setProgressText("");
    }
  };

  const quickAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const targetRefId = quickTargetRef.current;
    e.target.value = "";
    if (!files.length || !targetRefId) return;

    setUploadingRefId(targetRefId);
    setError("");
    try {
      for (const f of files) {
        await uploadSingleReferenceFile(targetRefId, f);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah lampiran.");
    } finally {
      setUploadingRefId(null);
      quickTargetRef.current = null;
    }
  };

  const removeReference = async (referenceId: string) => {
    if (!window.confirm("Hapus referensi jurnal ini beserta semua berkasnya?")) return;
    setError("");
    try {
      const res = await fetch("/api/meetings/references", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Gagal menghapus referensi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus referensi.");
    }
  };

  const removeFile = async (fileId: string) => {
    if (!window.confirm("Hapus berkas referensi ini?")) return;
    setError("");
    try {
      const res = await fetch("/api/meetings/references/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Gagal menghapus berkas.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus berkas.");
    }
  };

  return (
    <div className="ref-section">
      <div className="ref-header">
        <span className="tiny" style={{ fontWeight: 800, color: "#384860" }}>
          <i className="bi bi-journal-richtext" style={{ color: "var(--wine)", marginRight: 6 }} />
          Referensi Jurnal &amp; Pustaka ({references.length})
        </span>
        {canManage && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-circle" /> Tambah Referensi
          </button>
        )}
      </div>

      {error && !open && (
        <div className="feedback error" role="alert" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {references.length > 0 ? (
        <div className="ref-list">
          {references.map((refItem) => (
            <div className="ref-item" key={refItem.id}>
              <div className="ref-item-head">
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13, color: "#19253a" }}>
                    {refItem.title}
                  </strong>
                  {refItem.citation && (
                    <div className="tiny subtle" style={{ marginTop: 2 }}>
                      {refItem.citation}
                    </div>
                  )}
                </div>
                {canManage && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Lampirkan berkas tambahan"
                      disabled={uploadingRefId === refItem.id}
                      onClick={() => {
                        quickTargetRef.current = refItem.id;
                        quickInputRef.current?.click();
                      }}
                    >
                      <i className="bi bi-paperclip" />
                      {uploadingRefId === refItem.id ? "Mengunggah..." : "Upload"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-label={`Edit ${refItem.title}`}
                      onClick={() => openEdit(refItem)}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-label={`Hapus ${refItem.title}`}
                      onClick={() => void removeReference(refItem.id)}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                )}
              </div>

              {refItem.notes && (
                <p className="tiny" style={{ margin: 0, color: "#475569" }}>
                  {refItem.notes}
                </p>
              )}

              {refItem.reference_url && (
                <a
                  href={refItem.reference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="resource-link"
                  style={{ padding: "2px 0" }}
                >
                  <i className="bi bi-box-arrow-up-right" />
                  {refItem.reference_url}
                </a>
              )}

              {refItem.files.length > 0 && (
                <div className="ref-file-chips">
                  {refItem.files.map((file) => (
                    <span className="ref-file-chip" key={file.id}>
                      <i
                        className={`bi ${fileIcon(file.file_name)}`}
                        style={{ color: "var(--wine)" }}
                      />
                      {file.signedUrl ? (
                        <a
                          href={file.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {file.file_name}
                        </a>
                      ) : (
                        <span>{file.file_name}</span>
                      )}
                      <span className="subtle">({formatBytes(file.byte_size)})</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void removeFile(file.id)}
                          aria-label={`Hapus berkas ${file.file_name}`}
                          style={{
                            border: 0,
                            background: "none",
                            color: "#991b1b",
                            padding: "0 2px",
                            fontWeight: 800,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="tiny subtle">
          Belum ada referensi jurnal pada pertemuan ini.
        </div>
      )}

      {canManage && (
        <input
          ref={quickInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          style={{ display: "none" }}
          onChange={(e) => void quickAttach(e)}
        />
      )}

      {open && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`ref-modal-${meetingId}`}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <span className="kicker">REFERENSI PERTEMUAN</span>
                <h2 id={`ref-modal-${meetingId}`}>
                  {editingId ? "Perbarui Referensi Jurnal" : "Tambah Referensi Jurnal"}
                </h2>
              </div>
              <button
                type="button"
                className="close"
                aria-label="Tutup"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={submitForm} className="stack" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor={`ref-title-${meetingId}`}>Judul jurnal / buku / referensi</label>
                <input
                  id={`ref-title-${meetingId}`}
                  className="input"
                  required
                  minLength={2}
                  maxLength={220}
                  placeholder="Contoh: Usability Heuristics for Academic Portals (IEEE 2025)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor={`ref-citation-${meetingId}`}>
                  Penulis / Tahun / DOI / Sumber (opsional)
                </label>
                <input
                  id={`ref-citation-${meetingId}`}
                  className="input"
                  maxLength={1000}
                  placeholder="Contoh: Nielsen, J., & Budi, R. (2025) · DOI: 10.1109/..."
                  value={citation}
                  onChange={(e) => setCitation(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor={`ref-url-${meetingId}`}>
                  Tautan jurnal online HTTPS (opsional)
                </label>
                <input
                  id={`ref-url-${meetingId}`}
                  className="input"
                  type="url"
                  maxLength={2048}
                  placeholder="https://ieeexplore.ieee.org/... atau https://scholar.google.com/..."
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor={`ref-notes-${meetingId}`}>Catatan penggunaan (opsional)</label>
                <textarea
                  id={`ref-notes-${meetingId}`}
                  className="textarea"
                  style={{ minHeight: 72 }}
                  maxLength={2000}
                  placeholder="Bagian bab / halaman yang dibahas pada pertemuan ini..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="upload-card" style={{ marginTop: 4 }}>
                <label htmlFor={`ref-files-${meetingId}`}>
                  Unggah berkas referensi (bisa lebih dari satu, tanpa batas jumlah)
                </label>
                <input
                  id={`ref-files-${meetingId}`}
                  className="input"
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  onChange={(e) => setQueuedFiles(Array.from(e.target.files ?? []))}
                />
                <span className="field-hint">
                  Mendukung PDF, Word (.doc/.docx), ZIP/RAR/7z, PowerPoint, Excel,
                  gambar, TXT/MD/CSV/BibTeX/RIS (maks. 50 MB per berkas).
                </span>
                {queuedFiles.length > 0 && (
                  <div className="tiny" style={{ marginTop: 8, color: "#19253a" }}>
                    {queuedFiles.length} berkas siap diunggah:{" "}
                    {queuedFiles.map((f) => f.name).join(", ")}
                  </div>
                )}
              </div>

              {progressText && (
                <div className="feedback" role="status" style={{ margin: 0 }}>
                  {progressText}
                </div>
              )}
              {error && (
                <div className="feedback error" role="alert" style={{ margin: 0 }}>
                  {error}
                </div>
              )}

              <div className="form-actions" style={{ marginTop: 6 }}>
                <button className="btn btn-primary" disabled={busy}>
                  <i className="bi bi-check2-circle" />
                  {busy ? "Menyimpan..." : "Simpan Referensi"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

