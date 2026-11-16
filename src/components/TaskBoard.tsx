"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AcademicClass, Meeting, Role } from "@/types/domain";
import type { Assignment, Submission, SubmissionStat, TaskComponent } from "@/types/coursework";
import { COMPONENT_LABEL } from "@/types/coursework";
import { dateTimeWib, wibInput, wibToIso } from "@/lib/utils/wib";
import { postJson } from "@/lib/utils/request";
import { Empty, Tag } from "@/components/UI";
import { DeleteAssignmentButton } from "@/components/MeetingTasks";

function defaultDueWib(): string {
  return wibInput(new Date(Date.now() + 7 * 86400 * 1000).toISOString());
}

export function TaskBoard({
  assignments,
  classes,
  meetings = [],
  submissions,
  submissionStats = {},
  role,
  currentUserId,
  initialClassId = "",
}: {
  assignments: Assignment[];
  classes: AcademicClass[];
  meetings?: Meeting[];
  submissions: Submission[];
  submissionStats?: Record<string, SubmissionStat>;
  role: Role;
  currentUserId: string;
  initialClassId?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [open, setOpen] = useState(false);
  const [klass, setKlass] = useState(initialClassId || classes[0]?.id || "");
  const [meetingId, setMeetingId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [component, setComponent] = useState<TaskComponent>("daily_task");
  const [links, setLinks] = useState<string[]>([""]);
  const [due, setDue] = useState(defaultDueWib);
  const [late, setLate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [filterClassId, setFilterClassId] = useState(initialClassId);
  const [filterMeetingNo, setFilterMeetingNo] = useState<string>("");
  const [taskFilter, setTaskFilter] = useState<"all" | "ungraded" | "has_submission">("all");
  const [search, setSearch] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(18);

  const canCreate = (role === "dosen" || role === "mahasiswa" || role === "admin" || role === "super_admin") && classes.length > 0;
  const canManageClass = role === "admin" || role === "super_admin" || role === "dosen";

  const meetingsForFormClass = useMemo(
    () =>
      meetings
        .filter((m) => m.class_id === klass)
        .sort((a, b) => a.meeting_number - b.meeting_number),
    [meetings, klass]
  );

  const meetingNumbers = useMemo(
    () =>
      [
        ...new Set(
          assignments
            .filter((a) => !filterClassId || a.class_id === filterClassId)
            .map((a) => a.meetings?.meeting_number)
            .filter((n): n is number => typeof n === "number")
        ),
      ].sort((a, b) => a - b),
    [assignments, filterClassId]
  );

  const visibleAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (filterClassId && a.class_id !== filterClassId) return false;
      if (filterMeetingNo && String(a.meetings?.meeting_number ?? "") !== filterMeetingNo) return false;
      if (canManageClass && taskFilter === "ungraded" && (submissionStats[a.id]?.ungraded ?? 0) === 0) return false;
      if (canManageClass && taskFilter === "has_submission" && (submissionStats[a.id]?.total ?? 0) === 0) return false;
      if (!q) return true;
      return [a.title, a.description, a.classes?.class_code, a.classes?.courses?.name_id]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [assignments, canManageClass, filterClassId, filterMeetingNo, search, submissionStats, taskFilter]);

  const displayedAssignments = useMemo(
    () => visibleAssignments.slice(0, visibleLimit),
    [visibleAssignments, visibleLimit]
  );

  const add = () => {
    const defaultClass = filterClassId || classes[0]?.id || "";
    setEditing(null);
    setKlass(defaultClass);
    setMeetingId("");
    setTitle("");
    setDescription("");
    setComponent("daily_task");
    setLinks([""]);
    setDue(defaultDueWib());
    setLate(true);
    setOpen(true);
    setError("");
  };

  const edit = (a: Assignment) => {
    setEditing(a);
    setKlass(a.class_id);
    setMeetingId(a.meeting_id ?? "");
    setTitle(a.title);
    setDescription(a.description);
    setComponent(a.component);
    setLinks(a.resource_links.length ? a.resource_links : [""]);
    setDue(wibInput(a.due_at));
    setLate(a.accept_late);
    setOpen(true);
    setError("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const dueAt = wibToIso(due);
      await postJson("/api/assignments", {
        id: editing?.id ?? null,
        classId: klass,
        meetingId: meetingId || null,
        title,
        description,
        component,
        links: links.map((s) => s.trim()).filter(Boolean),
        dueAt,
        acceptLate: late,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tugas gagal disimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="filters" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: 1 }}>
          <label className="search">
            <i className="bi bi-search" />
            <input
              aria-label="Cari tugas"
              placeholder="Cari judul tugas atau mata kuliah..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter kelas"
            className="select"
            value={filterClassId}
            onChange={(e) => {
              setFilterClassId(e.target.value);
              setFilterMeetingNo("");
              setVisibleLimit(18);
            }}
          >
            <option value="">Semua Kelas ({classes.length})</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.courses.name_id} · {c.class_code}
              </option>
            ))}
          </select>
          {meetingNumbers.length > 0 && (
            <select
              aria-label="Filter pertemuan"
              className="select"
              value={filterMeetingNo}
              onChange={(e) => {
                setFilterMeetingNo(e.target.value);
                setVisibleLimit(18);
              }}
            >
              <option value="">Semua Pertemuan</option>
              {meetingNumbers.map((n) => (
                <option key={n} value={String(n)}>
                  Pertemuan #{n}
                </option>
              ))}
            </select>
          )}
          {canManageClass && (
            <div className="chip-row" role="group" aria-label="Filter status tugas">
              <button
                type="button"
                className={`btn btn-sm ${taskFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTaskFilter("all")}
              >
                Semua ({assignments.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${taskFilter === "ungraded" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTaskFilter("ungraded")}
              >
                Perlu Dinilai
              </button>
              <button
                type="button"
                className={`btn btn-sm ${taskFilter === "has_submission" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTaskFilter("has_submission")}
              >
                Ada Pengumpulan
              </button>
            </div>
          )}
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={add}>
            <i className="bi bi-plus-circle" /> Buat tugas
          </button>
        )}
      </div>

      {open && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panelhead">
            <h2>{editing ? "Ubah tugas" : "Tambah tugas baru"}</h2>
            <Tag kind="blue">Tersinkron ke Dosen & Kelas</Tag>
          </div>
          <form onSubmit={save} className="stack">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="task-class">Kelas</label>
                <select
                  id="task-class"
                  className="select"
                  value={klass}
                  disabled={Boolean(editing)}
                  onChange={(e) => {
                    setKlass(e.target.value);
                    setMeetingId("");
                  }}
                  required
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courses.name_id} · {c.class_code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="task-meeting">Pertemuan (opsional)</label>
                <select
                  id="task-meeting"
                  className="select"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                >
                  <option value="">Umum / Seluruh Kelas</option>
                  {meetingsForFormClass.map((m) => (
                    <option key={m.id} value={m.id}>
                      Pertemuan #{m.meeting_number} ·{" "}
                      {new Date(`${m.meeting_date}T00:00:00`).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="task-component">Komponen PAP</label>
                <select
                  id="task-component"
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
                <label htmlFor="task-due">Tenggat (WIB)</label>
                <input
                  id="task-due"
                  type="datetime-local"
                  className="input"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  required
                />
              </div>
            </div>
            <label className="checkline" style={{ minHeight: 32 }}>
              <input
                type="checkbox"
                checked={late}
                onChange={(e) => setLate(e.target.checked)}
              />
              <span>Izinkan pengumpulan setelah tenggat</span>
            </label>
            <div className="field">
              <label htmlFor="task-title">Judul tugas</label>
              <input
                id="task-title"
                className="input"
                minLength={5}
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Tugas Pertemuan 5 — Penyusunan SRS"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="task-description">Instruksi / soal tugas</label>
              <textarea
                id="task-description"
                className="textarea"
                rows={4}
                minLength={10}
                maxLength={6000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tuliskan deskripsi tugas atau soal pertemuan..."
                required
              />
            </div>
            <div className="field">
              <label>Tautan referensi (opsional)</label>
              {links.map((value, index) => (
                <div key={index} className="link-edit-row">
                  <input
                    aria-label={`Tautan referensi ${index + 1}`}
                    className="input"
                    value={value}
                    placeholder="https://github.com/..."
                    onChange={(e) =>
                      setLinks((v) => v.map((s, i) => (i === index ? e.target.value : s)))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setLinks((v) => v.filter((_, i) => i !== index))}
                    aria-label="Hapus tautan"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLinks((v) => [...v, ""])}
              >
                Tambah tautan
              </button>
            </div>
            {error && (
              <div className="feedback error" role="alert">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy || !klass}>
                {busy ? "Menyimpan..." : "Simpan dan publikasikan"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Batal
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="assignment-grid">
        {displayedAssignments.map((a) => {
          const own = submissions.find((s) => s.assignment_id === a.id);
          const stat = submissionStats[a.id];
          const expired = new Date(a.due_at) <= new Date();
          const isOwnerOrManager = canManageClass || a.author_id === currentUserId;
          return (
            <article className="panel assignment-card" key={a.id}>
              <div className="chip-row">
                <Link href={`/kelas/${a.class_id}`} title="Buka kelas ini">
                  <Tag kind="neutral">{a.classes?.class_code}</Tag>
                </Link>
                {a.meetings && (
                  <Link
                    href={`/kelas/${a.class_id}#pertemuan-${a.meetings.meeting_number}`}
                    title={`Buka Pertemuan #${a.meetings.meeting_number}`}
                  >
                    <Tag kind="blue">Pertemuan #{a.meetings.meeting_number}</Tag>
                  </Link>
                )}
                <Tag kind="neutral">{COMPONENT_LABEL[a.component]}</Tag>
                {canManageClass ? (
                  <Tag kind={stat?.ungraded ? "warn" : stat?.total ? "good" : "neutral"}>
                    {stat?.ungraded
                      ? `${stat.ungraded} Perlu Dinilai`
                      : stat?.total
                        ? `${stat.total} Terkumpul`
                        : "Menunggu Kiriman"}
                  </Tag>
                ) : (
                  <Tag
                    kind={
                      own?.score != null
                        ? "good"
                        : expired && !a.accept_late
                          ? "bad"
                          : own?.status === "SUBMITTED"
                            ? "good"
                            : "warn"
                    }
                  >
                    {own?.score != null
                      ? `Nilai ${own.score}`
                      : expired && !a.accept_late
                        ? "Ditutup"
                        : own?.status === "SUBMITTED"
                          ? "Dikumpulkan"
                          : "Terbuka"}
                  </Tag>
                )}
              </div>
              <h2 style={{ margin: "14px 0 6px" }}>
                <Link href={`/tugas/${a.id}`} className="crumb-link" style={{ color: "var(--ink)" }}>
                  {a.title}
                </Link>
              </h2>
              <p className="subtle tiny" style={{ marginBottom: 8 }}>
                <Link href={`/kelas/${a.class_id}`} className="crumb-link">
                  {a.classes?.courses?.name_id}
                </Link>
              </p>
              <p className="task-summary">{a.description}</p>
              <div className="stat-line">
                <span>Tenggat</span>
                <strong>{dateTimeWib(a.due_at)}</strong>
              </div>
              {canManageClass ? (
                <div className="stat-line">
                  <span>Pengumpulan / Dinilai</span>
                  <strong>
                    {stat?.total ?? 0} terkumpul · {stat?.graded ?? 0} dinilai
                  </strong>
                </div>
              ) : (
                own && (
                  <div className="stat-line">
                    <span>Revisi / Nilai</span>
                    <strong>
                      v{own.revision} · {own.score == null ? "Belum dinilai" : `${own.score}/100`}
                    </strong>
                  </div>
                )
              )}
              <div className="form-actions">
                <Link href={`/tugas/${a.id}`} className="btn btn-primary btn-sm">
                  {role === "mahasiswa" ? "Buka & kumpulkan" : "Lihat & nilai"}
                </Link>
                {isOwnerOrManager && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => edit(a)}
                  >
                    <i className="bi bi-pencil" /> Ubah
                  </button>
                )}
                {isOwnerOrManager && <DeleteAssignmentButton assignmentId={a.id} compact />}
              </div>
            </article>
          );
        })}
      </div>

      {visibleAssignments.length > displayedAssignments.length && (
        <div className="form-actions" style={{ justifyContent: "center", marginBottom: 24 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setVisibleLimit((n) => n + 18)}
          >
            Tampilkan lebih banyak ({visibleAssignments.length - displayedAssignments.length} lagi)
          </button>
        </div>
      )}

      {!visibleAssignments.length && (
        <Empty
          icon="clipboard-check"
          title="Belum ada tugas"
          message={
            canCreate
              ? "Klik tombol Buat tugas atau buka Pertemuan di halaman Kelas untuk menambahkan tugas baru."
              : "Tugas untuk kelas yang diikuti akan tampil di sini."
          }
        />
      )}
    </>
  );
}
