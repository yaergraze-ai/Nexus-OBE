"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { AcademicClass } from "@/types/domain";
import { Tag, ValidationStatus, Progress, Empty } from "@/components/UI";

export function ClassList({
  classes,
  preview = false,
  onSelect,
  enrolledIds,
  liveClassIds = [],
  taskCounts = {},
}: {
  classes: AcademicClass[];
  preview?: boolean;
  onSelect?: (id: string) => void;
  enrolledIds?: string[];
  liveClassIds?: string[];
  taskCounts?: Record<string, number>;
}) {
  const hasEnrollmentFilter = Array.isArray(enrolledIds);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("Semua Hari");
  const [scope, setScope] = useState<"enrolled" | "all">(
    hasEnrollmentFilter && (enrolledIds?.length ?? 0) > 0 ? "enrolled" : "all"
  );

  const enrolledSet = useMemo(() => new Set(enrolledIds ?? []), [enrolledIds]);
  const liveSet = useMemo(() => new Set(liveClassIds), [liveClassIds]);

  const filtered = useMemo(
    () =>
      classes.filter((c) => {
        if (hasEnrollmentFilter && scope === "enrolled" && !enrolledSet.has(c.id)) return false;
        const matchesQuery = [
          c.courses.name_id,
          c.courses.course_code,
          c.class_code,
          c.lecturer_directory.full_name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesQuery && (day === "Semua Hari" || c.schedule_day === day);
      }),
    [classes, day, enrolledSet, hasEnrollmentFilter, query, scope]
  );

  return (
    <>
      <div className="filters">
        <label className="search">
          <i className="bi bi-search" />
          <input
            aria-label="Cari mata kuliah"
            placeholder="Cari mata kuliah, dosen atau kelas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter hari"
          className="select"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        >
          {["Semua Hari", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        {hasEnrollmentFilter && (
          <div className="chip-row" role="group" aria-label="Filter KRS kelas">
            <button
              type="button"
              className={`btn btn-sm ${scope === "enrolled" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setScope("enrolled")}
            >
              Kelas KRS Saya ({enrolledSet.size})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${scope === "all" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setScope("all")}
            >
              Semua Katalog ({classes.length})
            </button>
          </div>
        )}
        <span className="subtle tiny">{filtered.length} kelas ditemukan</span>
      </div>

      <div className="class-grid">
        {filtered.map((c) => {
          const progress = Math.round((c.initial_meeting_count / c.rps_target_meetings) * 100);
          const link = `/kelas/${c.id}`;
          const isLive = liveSet.has(c.id);
          const isEnrolled = enrolledSet.has(c.id);
          const tasks = taskCounts[c.id] ?? 0;
          return (
            <article className="class-card" key={c.id}>
              <div className="class-card-top">
                <span className="course-code">
                  {c.courses.course_code} <span className="subtle">/ {c.class_code}</span>
                </span>
                <div className="chip-row">
                  {isLive && (
                    <Tag kind="live">
                      <i className="bi bi-broadcast" /> Sesi LIVE
                    </Tag>
                  )}
                  <ValidationStatus
                    kaprodi={c.rps_validated_kaprodi}
                    dekan={c.rps_validated_dekan}
                  />
                </div>
              </div>
              <h3 className="course-title">{c.courses.name_id}</h3>
              <div className="class-meta">
                <div>
                  <i className="bi bi-person" />
                  {c.lecturer_directory.full_name}
                </div>
                <div>
                  <i className="bi bi-calendar3" />
                  {c.schedule_day}, {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)} WIB
                </div>
                <div>
                  <i className="bi bi-geo-alt" />
                  {c.room_name}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 3,
                  fontSize: 11,
                }}
              >
                <span className="subtle">Pertemuan (rekap PRD)</span>
                <strong>
                  {c.initial_meeting_count}/{c.rps_target_meetings}
                </strong>
              </div>
              <Progress value={progress} />
              <div className="class-card-bottom">
                <div className="chip-row">
                  <Tag kind="neutral">{c.courses.sks_total} SKS</Tag>
                  {hasEnrollmentFilter && (
                    <Tag kind={isEnrolled ? "good" : "warn"}>
                      {isEnrolled ? "Terdaftar KRS" : "Non-KRS"}
                    </Tag>
                  )}
                  {tasks > 0 && <Tag kind="blue">{tasks} Tugas</Tag>}
                </div>
                {preview ? (
                  <button
                    className="section-link"
                    style={{ border: 0, background: "none", cursor: "pointer" }}
                    onClick={() => onSelect?.(c.id)}
                  >
                    Detail Kelas <i className="bi bi-arrow-up-right" />
                  </button>
                ) : (
                  <Link className="section-link" href={link}>
                    {isLive ? "Masuk & Absen" : "Detail Kelas"}{" "}
                    <i className="bi bi-arrow-up-right" />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <Empty
          icon="search"
          title="Tidak ada kelas"
          message="Ubah kata kunci pencarian, filter hari, atau tampilkan semua katalog."
        />
      )}
    </>
  );
}
