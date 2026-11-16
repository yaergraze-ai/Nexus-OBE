"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/types/domain";
import type { Assignment, Submission, SubmissionStat, TaskComponent } from "@/types/coursework";
import { COMPONENT_LABEL } from "@/types/coursework";
import { postJson } from "@/lib/utils/request";
import { dateTimeWib, wibInput, wibToIso } from "@/lib/utils/wib";
import { Tag } from "@/components/UI";

function defaultDueWib(): string {
  return wibInput(new Date(Date.now() + 7 * 86400 * 1000).toISOString());
}

export function DeleteAssignmentButton({
  assignmentId,
  redirectTo,
  compact = false,
}: {
  assignmentId: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    if (!window.confirm("Hapus tugas ini secara permanen beserta pengumpulannya?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menghapus tugas.");
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus tugas.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`btn btn-secondary ${compact ? "btn-sm" : ""}`}
        onClick={remove}
        disabled={busy}
        title="Hapus tugas yang Anda buat"
      >
        <i className="bi bi-trash" /> {busy ? "Menghapus..." : "Hapus"}
      </button>
      {error && (
        <span className="feedback error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

export function MeetingTasks({
  classId,
  meetingId,
  meetingNumber,
  tasks,
  submissions,
  submissionStats = {},
  currentUserId,
  role,
  canAdd,
  canManageAll,
}: {
  classId: string;
  meetingId: string;
  meetingNumber: number;
  tasks: Assignment[];
  submissions: Submission[];
  submissionStats?: Record<string, SubmissionStat>;
  currentUserId: string;
  role: Role;
  canAdd: boolean;
  canManageAll: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [component, setComponent] = useState<TaskComponent>("daily_task");
  const [linkUrl, setLinkUrl] = useState("");
  const [due, setDue] = useState(defaultDueWib);
  const [acceptLate, setAcceptLate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openForm = () => {
    setEditingId(null);
    setTitle(`Tugas Pertemuan ${meetingNumber} — `);
    setDescription("");
    setComponent("daily_task");
    setLinkUrl("");
    setDue(defaultDueWib());
    setAcceptLate(true);
    setError("");
    setOpen((prev) => !prev);
  };

  const openEdit = (t: Assignment) => {
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description);
    setComponent(t.component);
    setLinkUrl(t.resource_links[0] ?? "");
    setDue(wibInput(t.due_at));
    setAcceptLate(t.accept_late);
    setError("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const dueAt = wibToIso(due);
      const links = linkUrl.trim() ? [linkUrl.trim()] : [];
      await postJson("/api/assignments", {
        id: editingId,
        classId,
        meetingId,
        title: title.trim(),
        description: description.trim(),
        component,
        links,
        dueAt,
        acceptLate,
      });
      setOpen(false);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tugas pertemuan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ref-section">
      <div className="ref-header">
        <div>
          <strong style={{ fontSize: 13 }}>
            <i className="bi bi-clipboard2-check" style={{ color: "var(--wine)", marginRight: 6 }} />
            Tugas Pertemuan #{meetingNumber} ({tasks.length})
          </strong>
          <div className="tiny subtle">
            Klik tugas untuk melihat soal, unggah file pengumpulan, atau lihat nilai.
          </div>
        </div>
        {canAdd && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={openForm}
          >
            <i className={`bi bi-${open ? "x-lg" : "plus-circle"}`} />{" "}
            {open ? "Tutup form" : "Tambah Tugas"}
          </button>
        )}
      </div>

      {open && canAdd && (
        <form className="ref-item" onSubmit={submit} style={{ background: "#fff" }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor={`mt-title-${meetingId}`}>Judul tugas</label>
              <input
                id={`mt-title-${meetingId}`}
                className="input"
                minLength={5}
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder={`Contoh: Tugas Pertemuan ${meetingNumber}`}
              />
            </div>
            <div className="field">
              <label htmlFor={`mt-comp-${meetingId}`}>Komponen PAP</label>
              <select
                id={`mt-comp-${meetingId}`}
                className="select"
                value={component}
                onChange={(e) => setComponent(e.target.value as TaskComponent)}
              >
                {(Object.keys(COMPONENT_LABEL) as TaskComponent[]).map((k) => (
                  <option key={k} value={k}>
                    {COMPONENT_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`mt-due-${meetingId}`}>Tenggat (WIB)</label>
              <input
                id={`mt-due-${meetingId}`}
                type="datetime-local"
                className="input"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor={`mt-link-${meetingId}`}>Tautan materi/soal (opsional)</label>
              <input
                id={`mt-link-${meetingId}`}
                type="url"
                className="input"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`mt-desc-${meetingId}`}>Instruksi / soal tugas (teks)</label>
            <textarea
              id={`mt-desc-${meetingId}`}
              className="textarea"
              rows={3}
              minLength={10}
              maxLength={6000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Tuliskan instruksi atau soal tugas untuk pertemuan ini..."
            />
          </div>
          <label className="checkline" style={{ minHeight: 32 }}>
            <input
              type="checkbox"
              checked={acceptLate}
              onChange={(e) => setAcceptLate(e.target.checked)}
            />
            <span className="tiny">Izinkan pengumpulan fleksibel setelah tenggat</span>
          </label>
          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions" style={{ marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" disabled={busy}>
              <i className="bi bi-check2-circle" />{" "}
              {busy ? "Menyimpan..." : "Simpan Tugas"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setOpen(false)}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {tasks.length > 0 ? (
        <div className="ref-list">
          {(showAll ? tasks : tasks.slice(0, 3)).map((t) => {
            const own = submissions.find((s) => s.assignment_id === t.id);
            const stat = submissionStats[t.id];
            const expired = new Date(t.due_at) <= new Date();
            const canEditOrDelete = canManageAll || t.author_id === currentUserId;
            return (
              <div className="ref-item" key={t.id}>
                <div className="ref-item-head" style={{ flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link
                      href={`/tugas/${t.id}`}
                      className="crumb-link"
                      style={{ fontSize: 13 }}
                    >
                      {t.title}
                    </Link>
                    <div className="tiny subtle" style={{ marginTop: 2 }}>
                      {COMPONENT_LABEL[t.component]} · Tenggat {dateTimeWib(t.due_at)}
                    </div>
                  </div>
                  <div className="chip-row" style={{ gap: 6 }}>
                    {role === "mahasiswa" ? (
                      <Tag
                        kind={
                          own?.score != null
                            ? "good"
                            : own?.status === "SUBMITTED"
                              ? "blue"
                              : expired && !t.accept_late
                                ? "bad"
                                : "warn"
                        }
                      >
                        {own?.score != null
                          ? `Nilai ${own.score}/100`
                          : own?.status === "SUBMITTED"
                            ? `Terkumpul v${own.revision}`
                            : expired && !t.accept_late
                              ? "Ditutup"
                              : "Belum dikumpulkan"}
                      </Tag>
                    ) : (
                      <Tag kind={stat?.ungraded ? "warn" : stat?.total ? "good" : "blue"}>
                        {stat?.ungraded
                          ? `${stat.ungraded} Perlu Dinilai (${stat.total} masuk)`
                          : stat?.total
                            ? `${stat.total} Terkumpul`
                            : "Tugas Kelas"}
                      </Tag>
                    )}
                  </div>
                </div>
                <p
                  className="preline"
                  style={{
                    fontSize: 12,
                    color: "#334155",
                    margin: 0,
                  }}
                >
                  {t.description}
                </p>
                <div className="form-actions" style={{ marginTop: 4 }}>
                  <Link href={`/tugas/${t.id}`} className="btn btn-primary btn-sm">
                    <i className="bi bi-upload" />{" "}
                    {role === "mahasiswa"
                      ? own?.status === "SUBMITTED"
                        ? "Lihat / Revisi"
                        : "Kerjakan & Kumpulkan"
                      : "Lihat & Nilai"}
                  </Link>
                  {canEditOrDelete && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEdit(t)}
                    >
                      <i className="bi bi-pencil" /> Ubah
                    </button>
                  )}
                  {canEditOrDelete && (
                    <DeleteAssignmentButton assignmentId={t.id} compact />
                  )}
                </div>
              </div>
            );
          })}
          {tasks.length > 3 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "Tampilkan lebih ringkas"
                : `Lihat semua (${tasks.length} tugas pertemuan ini)`}
            </button>
          )}
        </div>
      ) : (
        <p className="subtle tiny" style={{ margin: 0 }}>
          Belum ada tugas pada pertemuan ini.{canAdd ? " Klik Tambah Tugas untuk membuat tugas." : ""}
        </p>
      )}
    </div>
  );
}

