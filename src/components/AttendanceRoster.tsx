"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/domain";
import { postJson } from "@/lib/utils/request";
import { Tag } from "@/components/UI";

type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; kind: "good" | "blue" | "warn" | "bad" }[] = [
  { value: "HADIR", label: "Hadir", kind: "good" },
  { value: "IZIN", label: "Izin", kind: "blue" },
  { value: "SAKIT", label: "Sakit", kind: "warn" },
  { value: "ALPHA", label: "Alpha", kind: "bad" },
];

export function AttendanceRoster({
  meetingId,
  students,
  initialStatuses,
}: {
  meetingId: string;
  students: Profile[];
  initialStatuses: Record<string, AttendanceStatus>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(initialStatuses);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const hadirCount = students.filter((s) => statuses[s.id] === "HADIR").length;

  const mark = async (studentId: string, status: AttendanceStatus) => {
    setBusyId(`${studentId}:${status}`);
    setError("");
    try {
      await postJson("/api/meetings/attendance", { meetingId, studentId, status });
      setStatuses((prev) => ({ ...prev, [studentId]: status }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui presensi.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <i className="bi bi-people-fill" /> Presensi Mahasiswa ({hadirCount}/{students.length} Hadir)
      </button>

      {open && (
        <div
          className="panel tight"
          style={{ marginTop: 10, padding: "12px 14px", background: "#fbfcfe" }}
        >
          {error && (
            <div className="feedback error" role="alert" style={{ marginBottom: 10 }}>
              {error}
            </div>
          )}
          {students.length === 0 ? (
            <p className="subtle tiny" style={{ margin: 0 }}>
              Belum ada mahasiswa terdaftar KRS pada kelas ini.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mahasiswa</th>
                    <th>Status</th>
                    <th>Ubah Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const current = statuses[s.id];
                    const optMeta = STATUS_OPTIONS.find((o) => o.value === current);
                    return (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.full_name}</strong>
                          <div className="tiny subtle">{s.identity_number}</div>
                        </td>
                        <td>
                          <Tag kind={optMeta?.kind ?? "neutral"}>
                            {optMeta?.label ?? "Belum Absen"}
                          </Tag>
                        </td>
                        <td>
                          <div className="chip-row">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                className={`btn btn-sm ${
                                  current === opt.value ? "btn-primary" : "btn-secondary"
                                }`}
                                disabled={busyId !== ""}
                                onClick={() => mark(s.id, opt.value)}
                              >
                                {busyId === `${s.id}:${opt.value}` ? "..." : opt.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
