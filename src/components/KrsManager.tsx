"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AcademicClass, Profile } from "@/types/domain";
import { postJson } from "@/lib/utils/request";
import { Empty, Tag } from "@/components/UI";

interface EnrollmentRecord {
  class_id: string;
  student_id: string;
  enrolled_at?: string;
}

export function KrsManager({
  classes,
  students,
  enrollments = [],
}: {
  classes: AcademicClass[];
  students: Profile[];
  enrollments?: EnrollmentRecord[];
}) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  const selectedClass = classes.find((c) => c.id === classId);
  const roster = useMemo(
    () =>
      enrollments
        .filter((e) => e.class_id === classId)
        .map((e) => studentById.get(e.student_id))
        .filter((s): s is Profile => Boolean(s)),
    [classId, enrollments, studentById]
  );

  const enrolledInSelected = useMemo(
    () => new Set(roster.map((s) => s.id)),
    [roster]
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      await postJson("/api/enrollments", { classId, studentId });
      setMessage("Mahasiswa berhasil didaftarkan dalam kelas.");
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Pendaftaran gagal.");
    } finally {
      setBusy(false);
    }
  };

  const syncAll = async () => {
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await postJson<{ syncedStudents?: number }>("/api/enrollments", {
        action: "sync_all",
      });
      setMessage(
        `Sinkronisasi selesai (${res.syncedStudents ?? students.length} mahasiswa aktif diperiksa).`
      );
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Sinkronisasi KRS gagal.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (targetStudentId: string, fullName: string) => {
    if (!window.confirm(`Keluarkan ${fullName} dari kelas ${selectedClass?.courses.name_id}?`)) {
      return;
    }
    setRemovingId(targetStudentId);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, studentId: targetStudentId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Gagal mengeluarkan peserta.");
      setMessage(`${fullName} dikeluarkan dari KRS kelas ini.`);
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Gagal mengeluarkan peserta.");
    } finally {
      setRemovingId("");
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panelhead">
          <div>
            <h2>Tambah Peserta KRS</h2>
            <p className="subtle tiny" style={{ margin: "4px 0 0" }}>
              Otomatis menolak kelas yang bentrok jadwal jam kuliah bagi mahasiswa yang sama.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || !students.length}
            onClick={syncAll}
          >
            <i className="bi bi-arrow-repeat" /> Sinkronkan Semua Mahasiswa Aktif
          </button>
        </div>

        <form onSubmit={save}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="krs-class">Kelas</label>
              <select
                className="select"
                id="krs-class"
                value={classId}
                required
                onChange={(e) => setClassId(e.target.value)}
              >
                {classes.map((c) => {
                  const count = enrollments.filter((x) => x.class_id === c.id).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.courses.course_code} · {c.courses.name_id} ({c.class_code}) · {count} mhs
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="field">
              <label htmlFor="krs-student">Mahasiswa</label>
              <select
                className="select"
                id="krs-student"
                value={studentId}
                required
                onChange={(e) => setStudentId(e.target.value)}
              >
                {students.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.full_name} · {s.identity_number}
                    {enrolledInSelected.has(s.id) ? " (Sudah terdaftar)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!students.length && (
            <p className="feedback error" style={{ marginTop: 12 }}>
              Belum ada akun mahasiswa aktif atau akses RLS pengelola menunggu migrasi 008.
            </p>
          )}
          {message && (
            <p className={`feedback ${isError ? "error" : ""}`} style={{ marginTop: 12 }}>
              {message}
            </p>
          )}
          <div className="form-actions">
            <button
              disabled={busy || !students.length || !classes.length}
              className="btn btn-primary"
            >
              {busy ? "Menyimpan..." : "Daftarkan ke Kelas"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel tight">
        <div className="panelhead" style={{ padding: "18px 20px 12px" }}>
          <div>
            <h2>
              Daftar Peserta · {selectedClass?.courses.name_id || "Kelas"} ({selectedClass?.class_code || "—"})
            </h2>
            <p className="subtle tiny" style={{ margin: "4px 0 0" }}>
              {selectedClass
                ? `${selectedClass.schedule_day}, ${selectedClass.start_time.slice(0, 5)}–${selectedClass.end_time.slice(0, 5)} WIB · ${selectedClass.room_name}`
                : ""}
            </p>
          </div>
          <Tag kind="blue">{roster.length} Mahasiswa Terdaftar</Tag>
        </div>
        {roster.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Mahasiswa</th>
                  <th>NIM</th>
                  <th>Email</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.full_name}</strong>
                    </td>
                    <td>{s.identity_number}</td>
                    <td className="tiny subtle">{s.email}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={removingId === s.id}
                        onClick={() => remove(s.id, s.full_name)}
                      >
                        <i className="bi bi-person-dash" />{" "}
                        {removingId === s.id ? "Menghapus..." : "Keluarkan"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            <Empty
              icon="people"
              title="Belum ada peserta KRS di kelas ini"
              message="Pilih mahasiswa pada formulir di atas atau klik Sinkronkan Semua Mahasiswa Aktif."
            />
          </div>
        )}
      </section>
    </div>
  );
}
