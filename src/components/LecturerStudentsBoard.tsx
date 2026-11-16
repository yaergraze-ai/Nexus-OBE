"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { AcademicClass, Role } from "@/types/domain";
import type { TeachingStudentSummary } from "@/lib/data";
import { Empty, Metric, Progress, Tag } from "@/components/UI";

type StatusFilter = "all" | "attention" | "ungraded" | "good";
type SortBy = "name" | "nim" | "att_desc" | "att_asc" | "grade_desc";

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Interactive student roster directory allowing lecturers (and academic admins)
 * to inspect total unique/per-class student counts, attendance rates, and PAP grades.
 */
export function LecturerStudentsBoard({
  role,
  classes,
  students,
  classCounts,
  initialClassId = "",
}: {
  role: Role;
  classes: AcademicClass[];
  students: TeachingStudentSummary[];
  classCounts: Record<string, number>;
  initialClassId?: string;
}) {
  const [selectedClassId, setSelectedClassId] = useState(
    classes.some((c) => c.id === initialClassId) ? initialClassId : ""
  );
  const [lecturerFilter, setLecturerFilter] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const lecturers = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      map.set(c.lecturer_identity_number, c.lecturer_directory.full_name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [classes]);

  const activeScopeClasses = useMemo(() => {
    return classes.filter((c) => {
      if (selectedClassId && c.id !== selectedClassId) return false;
      if (lecturerFilter && c.lecturer_identity_number !== lecturerFilter) {
        return false;
      }
      return true;
    });
  }, [classes, lecturerFilter, selectedClassId]);

  const scopedStudents = useMemo(() => {
    const allowedIds = new Set(activeScopeClasses.map((c) => c.id));
    return students
      .map((st) => {
        const scopedStandings = st.classes.filter((sc) =>
          allowedIds.has(sc.classId)
        );
        if (!scopedStandings.length) return null;

        const withMtgs = scopedStandings.filter((c) => c.totalMeetings > 0);
        const avgAtt = withMtgs.length
          ? Math.round(
              withMtgs.reduce((s, c) => s + c.attendancePct, 0) / withMtgs.length
            )
          : 100;
        const graded = scopedStandings.filter((c) => c.gradeNumeric !== null);
        const avgNum = graded.length
          ? Math.round(
              (graded.reduce((s, c) => s + (c.gradeNumeric ?? 0), 0) /
                graded.length) *
                100
            ) / 100
          : null;
        const lowAtt = withMtgs.some((c) => c.attendancePct < 75);
        const belowTarget = scopedStandings.some(
          (c) => c.gradeQuality !== null && c.gradeQuality < c.passingTarget
        );

        return {
          ...st,
          classes: scopedStandings,
          avgAttendancePct: avgAtt,
          gradedCount: graded.length,
          avgNumeric: avgNum,
          needsAttention: lowAtt || belowTarget,
        };
      })
      .filter((x): x is TeachingStudentSummary => Boolean(x));
  }, [activeScopeClasses, students]);

  const summary = useMemo(() => {
    const uniqueCount = scopedStudents.length;
    const totalSeats = scopedStudents.reduce(
      (sum, st) => sum + st.classes.length,
      0
    );
    const attKnown = scopedStudents.flatMap((st) =>
      st.classes.filter((c) => c.totalMeetings > 0)
    );
    const avgAtt = attKnown.length
      ? Math.round(
          attKnown.reduce((sum, c) => sum + c.attendancePct, 0) / attKnown.length
        )
      : 100;
    const gradedSeats = scopedStudents.reduce(
      (sum, st) => sum + st.gradedCount,
      0
    );
    const attentionCount = scopedStudents.filter(
      (st) => st.needsAttention
    ).length;

    return {
      uniqueCount,
      totalSeats,
      avgAtt,
      gradedSeats,
      attentionCount,
    };
  }, [scopedStudents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...scopedStudents]
      .filter((st) => {
        if (q) {
          const hay = [
            st.fullName,
            st.identityNumber,
            st.email,
            ...st.classes.map((c) => `${c.courseName} ${c.classCode}`),
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (statusFilter === "attention") return st.needsAttention;
        if (statusFilter === "ungraded") {
          return st.gradedCount < st.classes.length;
        }
        if (statusFilter === "good") {
          return !st.needsAttention && st.avgAttendancePct >= 75;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "nim") {
          return a.identityNumber.localeCompare(b.identityNumber);
        }
        if (sortBy === "att_desc") {
          return b.avgAttendancePct - a.avgAttendancePct;
        }
        if (sortBy === "att_asc") {
          return a.avgAttendancePct - b.avgAttendancePct;
        }
        if (sortBy === "grade_desc") {
          return (b.avgNumeric ?? -1) - (a.avgNumeric ?? -1);
        }
        return a.fullName.localeCompare(b.fullName);
      });
  }, [query, scopedStudents, sortBy, statusFilter]);

  const exportCsv = () => {
    const headers = [
      "Nama Mahasiswa",
      "NIM",
      "Email",
      "Jumlah Kelas",
      "Mata Kuliah Diikuti",
      "Rata-rata Kehadiran (%)",
      "Kelas Sudah Dinilai",
      "Rata-rata Nilai PAP",
    ];
    const rows = filtered.map((st) =>
      [
        st.fullName,
        st.identityNumber,
        st.email,
        st.classes.length,
        st.classes.map((c) => `${c.courseName} (${c.classCode})`).join("; "),
        st.avgAttendancePct,
        `${st.gradedCount}/${st.classes.length}`,
        st.avgNumeric !== null ? st.avgNumeric.toFixed(2) : "-",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
    const csv = [headers.map(escapeCsvCell).join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-mahasiswa-${selectedClassId ? "kelas" : "semua"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="metrics">
        <Metric
          icon="people-fill"
          label="Total Mahasiswa Unik"
          value={summary.uniqueCount}
          note={`Terdaftar di ${activeScopeClasses.length} kelas aktif`}
        />
        <Metric
          icon="person-badge"
          label="Total Peserta Kelas"
          value={summary.totalSeats}
          note={
            activeScopeClasses.length
              ? `Rata-rata ${(summary.totalSeats / activeScopeClasses.length).toFixed(1)} mhs/kelas`
              : "Belum ada kelas"
          }
        />
        <Metric
          icon="calendar2-check"
          label="Rata-rata Kehadiran"
          value={`${summary.avgAtt}%`}
          note={
            summary.attentionCount > 0
              ? `${summary.attentionCount} mahasiswa perlu perhatian`
              : "Semua aman >= 75%"
          }
        />
        <Metric
          icon="clipboard2-data"
          label="Nilai PAP Terisi"
          value={`${summary.gradedSeats}/${summary.totalSeats}`}
          note="Komponen akhir kelas"
          href={
            selectedClassId
              ? `/kelas/${selectedClassId}/nilai`
              : "/nilai"
          }
        />
      </div>

      {classes.length > 0 && (
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panelhead">
            <h2>Distribusi per Kelas</h2>
            <Tag kind="blue">{classes.length} kelas aktif</Tag>
          </div>
          <div className="course-pills" role="group" aria-label="Filter berdasarkan mata kuliah">
            <button
              type="button"
              className={`btn btn-sm ${
                selectedClassId === "" ? "btn-primary" : "btn-secondary"
              }`}
              onClick={() => setSelectedClassId("")}
            >
              Semua Kelas ({students.length} unik)
            </button>
            {classes.map((c) => {
              const count = classCounts[c.id] ?? 0;
              const active = selectedClassId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`}
                  onClick={() =>
                    setSelectedClassId((prev) => (prev === c.id ? "" : c.id))
                  }
                >
                  <span>{c.courses.name_id}</span>
                  <span className="pill-count">
                    {c.class_code} · {count} mhs
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="filters" style={{ justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          <label className="search">
            <i className="bi bi-search" />
            <input
              aria-label="Cari mahasiswa"
              placeholder="Cari nama, NIM, email, atau mata kuliah..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {role !== "dosen" && lecturers.length > 1 && (
            <select
              aria-label="Filter dosen pengampu"
              className="select"
              value={lecturerFilter}
              onChange={(e) => setLecturerFilter(e.target.value)}
            >
              <option value="">Semua Dosen</option>
              {lecturers.map(([idNo, name]) => (
                <option key={idNo} value={idNo}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filter status mahasiswa"
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Semua Status ({scopedStudents.length})</option>
            <option value="attention">
              Perlu Perhatian ({summary.attentionCount})
            </option>
            <option value="ungraded">Belum Dinilai Lengkap</option>
            <option value="good">Kehadiran &gt;= 75%</option>
          </select>
          <select
            aria-label="Urutkan mahasiswa"
            className="select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="name">Urutkan: Nama A–Z</option>
            <option value="nim">Urutkan: NIM</option>
            <option value="att_desc">Kehadiran Tertinggi</option>
            <option value="att_asc">Kehadiran Terendah</option>
            <option value="grade_desc">Nilai Tertinggi</option>
          </select>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={filtered.length === 0}
          onClick={exportCsv}
        >
          <i className="bi bi-download" /> Unduh CSV ({filtered.length})
        </button>
      </div>

      {filtered.length ? (
        <div className="panel tight">
          <div className="table-scroll">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>NIM</th>
                  <th>Kelas Diikuti</th>
                  <th>Kehadiran</th>
                  <th>Nilai PAP</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((st) => {
                  const isExpanded = expandedId === st.studentId;
                  return (
                    <Fragment key={st.studentId}>
                      <tr>
                        <td className="wrap" data-primary="true">
                          <div className="student-identity-cell">
                            <span className="avatar student-mini-avatar" aria-hidden="true">
                              {initials(st.fullName) || "M"}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <strong>{st.fullName}</strong>
                              <div className="tiny subtle" style={{ overflowWrap: "anywhere" }}>
                                {st.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td data-label="NIM">
                          <strong>{st.identityNumber}</strong>
                        </td>
                        <td className="wrap" data-label="Kelas">
                          <div className="chip-row">
                            {st.classes.map((c) => (
                              <Link
                                key={c.classId}
                                href={`/kelas/${c.classId}`}
                                className="tag neutral"
                              >
                                {c.courseCode} · {c.classCode}
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td data-label="Kehadiran">
                          <div style={{ minWidth: 112 }}>
                            <div
                              className="tiny"
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <span>{st.avgAttendancePct}%</span>
                              <span
                                style={{
                                  color: st.needsAttention ? "#b91c1c" : "#15803d",
                                  fontWeight: 700,
                                }}
                              >
                                {st.avgAttendancePct >= 75 ? "Aman" : "< 75%"}
                              </span>
                            </div>
                            <Progress value={st.avgAttendancePct} />
                          </div>
                        </td>
                        <td data-label="Nilai PAP">
                          {st.avgNumeric !== null ? (
                            <Tag kind="blue">
                              Rata² {st.avgNumeric.toFixed(2)} ({st.gradedCount}/
                              {st.classes.length})
                            </Tag>
                          ) : (
                            <Tag kind="neutral">
                              Belum ({st.gradedCount}/{st.classes.length})
                            </Tag>
                          )}
                        </td>
                        <td data-actions="true">
                          <button
                            type="button"
                            className={`btn btn-sm ${
                              isExpanded ? "btn-primary" : "btn-secondary"
                            }`}
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpandedId((prev) =>
                                prev === st.studentId ? null : st.studentId
                              )
                            }
                          >
                            <i
                              className={`bi ${
                                isExpanded ? "bi-chevron-up" : "bi-chevron-down"
                              }`}
                            />
                            {isExpanded
                              ? "Tutup Rincian"
                              : `Rincian (${st.classes.length})`}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="student-detail-row">
                          <td colSpan={6} data-detail="true">
                            <div className="student-mini-breakdown">
                              {st.classes.map((c) => (
                                <div className="student-mini-card" key={c.classId}>
                                  <div className="student-mini-card-head">
                                    <div>
                                      <strong>{c.courseName}</strong>
                                      <div className="tiny subtle">
                                        {c.courseCode} · {c.classCode} · {c.scheduleDay}{" "}
                                        {c.startTime.slice(0, 5)}–{c.endTime.slice(0, 5)} WIB
                                      </div>
                                    </div>
                                    {c.gradeNumeric !== null && c.gradeQuality !== null ? (
                                      <Tag
                                        kind={
                                          c.gradeQuality >= c.passingTarget
                                            ? "good"
                                            : "bad"
                                        }
                                      >
                                        {c.gradeLetter} · {c.gradeNumeric.toFixed(2)}
                                      </Tag>
                                    ) : (
                                      <Tag kind="neutral">Belum Dinilai</Tag>
                                    )}
                                  </div>
                                  <div className="stat-line">
                                    <span>Kehadiran</span>
                                    <strong>
                                      {c.totalMeetings > 0
                                        ? `${c.attendedCount}/${c.totalMeetings} (${c.attendancePct}%)`
                                        : "Belum ada pertemuan"}
                                    </strong>
                                  </div>
                                  <div className="form-actions" style={{ marginTop: 10 }}>
                                    <Link
                                      href={`/kelas/${c.classId}`}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      Detail Kelas
                                    </Link>
                                    <Link
                                      href={`/kelas/${c.classId}/nilai`}
                                      className="btn btn-primary btn-sm"
                                    >
                                      Input Nilai PAP
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon="people"
            title="Belum ada mahasiswa cocok dengan filter"
            message="Coba ubah kata kunci pencarian, filter kelas, atau status kehadiran."
          />
        </div>
      )}
    </>
  );
}
