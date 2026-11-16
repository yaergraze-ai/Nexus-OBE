import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sessionContext } from "@/lib/auth";
import {
  readAssignmentsBoard,
  readClass,
  readGrades,
  readMeetings,
  readMeetingReferences,
  readStudents,
} from "@/lib/data";
import { Tag, ValidationStatus, Progress, Empty } from "@/components/UI";
import { StartMeeting, CheckIn, EditMeetingSummary } from "@/components/MeetingManager";
import { AttendanceRoster } from "@/components/AttendanceRoster";
import { MeetingReferences } from "@/components/MeetingReferences";
import { MeetingTasks } from "@/components/MeetingTasks";
import { ActionButton } from "@/components/ActionButton";
import { calculateFinal } from "@/lib/utils/grade-calculator";
import type { Profile } from "@/types/domain";
import type { Submission } from "@/types/coursework";

type AttStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA";

const ATT_TAG: Record<AttStatus, { label: string; kind: "good" | "blue" | "warn" | "bad" }> = {
  HADIR: { label: "Hadir", kind: "good" },
  IZIN: { label: "Izin", kind: "blue" },
  SAKIT: { label: "Sakit", kind: "warn" },
  ALPHA: { label: "Alpha", kind: "bad" },
};

export const metadata: Metadata = { title: "Detail Kelas" };

export default async function ClassDetail({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { db, profile } = await sessionContext();
  const klass = await readClass(db, classId);
  if (!klass) notFound();

  const teacher =
    profile.role === "dosen" &&
    profile.identity_number === klass.lecturer_identity_number;
  const canAdmin = profile.role === "admin" || profile.role === "super_admin";
  const manageRoster = teacher || canAdmin;

  const [meetings, refsByMeeting, classTasks, enrollRow, grades, rosterStudents] =
    await Promise.all([
      readMeetings(db, classId),
      readMeetingReferences(db, classId),
      readAssignmentsBoard(db, classId),
      profile.role === "mahasiswa"
        ? db
            .from("class_enrollments")
            .select("id")
            .eq("class_id", classId)
            .eq("student_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      readGrades(db, classId),
      manageRoster ? readStudents(db, classId) : Promise.resolve([] as Profile[]),
    ]);

  const canStudentAddTask = profile.role === "mahasiswa" && Boolean(enrollRow.data);
  const canAddTask = teacher || canAdmin || canStudentAddTask;
  const meetingIds = meetings.map((m) => m.id);
  const taskIds = classTasks.map((t) => t.id);

  const [{ data: attendanceRows }, { data: mySubs }] = await Promise.all([
    meetingIds.length && profile.role === "mahasiswa"
      ? db
          .from("attendances")
          .select("meeting_id,status")
          .in("meeting_id", meetingIds)
          .eq("student_id", profile.id)
      : meetingIds.length && manageRoster
        ? db
            .from("attendances")
            .select("meeting_id,student_id,status")
            .in("meeting_id", meetingIds)
        : Promise.resolve({ data: [] }),
    taskIds.length && profile.role === "mahasiswa"
      ? db
          .from("assignment_submissions")
          .select("*")
          .eq("student_id", profile.id)
          .in("assignment_id", taskIds)
      : Promise.resolve({ data: [] }),
  ]);

  const myAttendanceMap = new Map<string, AttStatus>();
  const rosterAttendanceMap = new Map<string, Record<string, AttStatus>>();
  for (const row of (attendanceRows ?? []) as {
    meeting_id: string;
    student_id?: string;
    status: AttStatus;
  }[]) {
    if (profile.role === "mahasiswa") {
      myAttendanceMap.set(row.meeting_id, row.status);
    } else if (row.student_id) {
      const current = rosterAttendanceMap.get(row.meeting_id) ?? {};
      current[row.student_id] = row.status;
      rosterAttendanceMap.set(row.meeting_id, current);
    }
  }

  const attended = new Set(myAttendanceMap.keys());
  const submissions = (mySubs ?? []) as Submission[];
  const photos = await Promise.all(
    meetings.map(async (m) =>
      m.documentation_photo_path
        ? db.storage.from("bap-documents").createSignedUrl(m.documentation_photo_path, 3600)
        : null
    )
  );
  const active = meetings.some(
    (m) => m.status === "LIVE" && new Date(m.ends_at) > new Date()
  );
  const meetingDoneCount = Math.max(klass.initial_meeting_count, meetings.length);

  const hadirCount = meetings.filter(
    (m) => myAttendanceMap.get(m.id) === "HADIR"
  ).length;
  const attendancePct =
    meetings.length > 0 ? Math.round((hadirCount / meetings.length) * 100) : 0;

  const myGrade =
    profile.role === "mahasiswa"
      ? grades.find((g) => g.student_id === profile.id)
      : undefined;
  const finalSummary = myGrade
    ? calculateFinal(
        {
          attendance: myGrade.score_attendance,
          uts: myGrade.score_uts,
          uas: myGrade.score_uas,
          daily_task: myGrade.score_daily_task,
          group_task: myGrade.score_group_task,
          major_project: myGrade.score_major_project,
        },
        {
          attendance: klass.weight_attendance,
          uts: klass.weight_uts,
          uas: klass.weight_uas,
          daily_task: klass.weight_daily_task,
          group_task: klass.weight_group_task,
          major_project: klass.weight_major_project,
        }
      )
    : null;

  return (
    <>
      <div className="subtle tiny" style={{ marginBottom: 14 }}>
        <Link href="/kelas" className="crumb-link">
          Kelas Kuliah
        </Link>{" "}
        / {klass.courses.name_id}
      </div>

      <div className="hero-sub">
        <div>
          <div className="kicker">
            {klass.courses.course_code} · {klass.class_code}
          </div>
          <h1>{klass.courses.name_id}</h1>
          <div className="chip-row">
            <ValidationStatus
              kaprodi={klass.rps_validated_kaprodi}
              dekan={klass.rps_validated_dekan}
            />
            <Tag kind="neutral">{klass.courses.sks_total} SKS</Tag>
            <Tag kind={klass.pbm_period === "on" ? "good" : "bad"}>
              PBM {klass.pbm_period.toUpperCase()}
            </Tag>
            {active && (
              <Tag kind="live">
                <i className="bi bi-broadcast" /> Sesi LIVE Dibuka
              </Tag>
            )}
          </div>
        </div>
        {teacher && (
          <StartMeeting
            classId={classId}
            enabled={
              klass.rps_validated_kaprodi &&
              klass.rps_validated_dekan &&
              klass.pbm_period === "on" &&
              !active
            }
            scheduleDay={klass.schedule_day}
            startTime={klass.start_time}
            endTime={klass.end_time}
          />
        )}
      </div>

      <div className="tabs">
        <Link className="active" href={`/kelas/${classId}`}>
          Pertemuan
        </Link>
        <Link href={`/kelas/${classId}/rps`}>RPS &amp; OBE</Link>
        <Link href={`/kelas/${classId}/raport`}>E-Raport</Link>
        <Link href={`/tugas?classId=${classId}`}>Tugas &amp; Pengumpulan</Link>
        {manageRoster && <Link href={`/kelas/${classId}/nilai`}>Input Nilai</Link>}
      </div>

      {profile.role === "mahasiswa" && !canStudentAddTask && (
        <div className="notice" style={{ marginBottom: 18 }}>
          <i className="bi bi-exclamation-circle" />
          <div>
            <strong>Belum terdaftar di KRS kelas ini</strong>
            <p>
              Akun Anda tidak tercantum sebagai peserta kelas ini (biasanya karena bentrok
              jadwal dengan kelas lain). Hubungi Admin pada menu Peserta KRS bila perlu pindah
              jadwal.
            </p>
          </div>
        </div>
      )}

      <div className="details-grid">
        <div className="stack">
          <section className="panel">
            <div className="panelhead">
              <h2>Riwayat Pertemuan</h2>
              <Tag kind="neutral">{meetings.length} rekaman digital</Tag>
            </div>
            {meetings.length ? (
              meetings.map((m, i) => {
                const live =
                  m.status === "LIVE" && new Date(m.ends_at) > new Date();
                const meetingTasks = classTasks.filter((t) => t.meeting_id === m.id);
                const rosterStatuses = rosterAttendanceMap.get(m.id) ?? {};
                return (
                  <div
                    className="meeting-card"
                    id={`pertemuan-${m.meeting_number}`}
                    key={m.id}
                  >
                    <div className="meeting-n">
                      {String(m.meeting_number).padStart(2, "0")}
                    </div>
                    <div className="meeting-body">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <h3>
                          {m.type} · Pertemuan ke-{m.meeting_number}
                        </h3>
                        <Tag kind={live ? "live" : "neutral"}>
                          {live ? "LIVE" : "Terkunci"}
                        </Tag>
                      </div>
                      <p>
                        <i className="bi bi-calendar3" />{" "}
                        {new Date(m.meeting_date + "T00:00:00").toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="preline" style={{ color: "#37475e" }}>
                        {m.summary}
                      </p>
                      {photos[i]?.data?.signedUrl && (
                        <Image
                          className="meeting-photo"
                          unoptimized
                          width={270}
                          height={170}
                          src={photos[i]!.data!.signedUrl}
                          alt={`Dokumentasi pertemuan ${m.meeting_number}`}
                        />
                      )}
                      <div className="form-actions">
                        {profile.role === "mahasiswa" && canStudentAddTask && (
                          <CheckIn meeting={m} already={attended.has(m.id)} />
                        )}
                        {teacher && <EditMeetingSummary meeting={m} />}
                        {teacher && live && (
                          <ActionButton
                            url="/api/meetings/finish"
                            payload={{ meetingId: m.id }}
                            label="Selesai Pertemuan"
                            icon="lock"
                            kind="secondary"
                            confirm="Tutup presensi dan kunci BAP sekarang?"
                          />
                        )}
                        {canAdmin && !live && (
                          <ActionButton
                            url="/api/meetings/override"
                            payload={{ meetingId: m.id }}
                            label="Buka koreksi 30 menit"
                            icon="unlock"
                            kind="secondary"
                            confirm="Catat pembukaan BAP dalam log audit?"
                          />
                        )}
                      </div>
                      {manageRoster && (
                        <AttendanceRoster
                          meetingId={m.id}
                          students={rosterStudents}
                          initialStatuses={rosterStatuses}
                        />
                      )}
                      <MeetingTasks
                        classId={classId}
                        meetingId={m.id}
                        meetingNumber={m.meeting_number}
                        tasks={meetingTasks}
                        submissions={submissions}
                        currentUserId={profile.id}
                        role={profile.role}
                        canAdd={canAddTask}
                        canManageAll={manageRoster}
                      />
                      <MeetingReferences
                        meetingId={m.id}
                        references={refsByMeeting[m.id] ?? []}
                        canManage={manageRoster}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty
                icon="journal-text"
                title="Belum ada BAP digital"
                message={`PRD mencatat ${klass.initial_meeting_count} pertemuan sebelumnya. Dosen dapat klik Mulai Pertemuan untuk membuka sesi LIVE baru.`}
              />
            )}
          </section>

          <section className="panel">
            <div className="panelhead">
              <h2>Statistik Kehadiran &amp; Nilai</h2>
              {profile.role === "mahasiswa" ? (
                <Tag kind={attendancePct >= 75 ? "good" : "warn"}>
                  Kehadiran {hadirCount}/{meetings.length} ({attendancePct}%)
                </Tag>
              ) : (
                <Tag kind="blue">{rosterStudents.length} peserta KRS</Tag>
              )}
            </div>

            {profile.role === "mahasiswa" ? (
              <>
                {meetings.length ? (
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ke #</th>
                          <th>Tanggal</th>
                          <th>Jenis</th>
                          <th>Status</th>
                          <th>Tugas Pertemuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meetings.map((m) => {
                          const st = myAttendanceMap.get(m.id);
                          const tagMeta = st ? ATT_TAG[st] : null;
                          const taskCount = classTasks.filter(
                            (t) => t.meeting_id === m.id
                          ).length;
                          return (
                            <tr key={m.id}>
                              <td>
                                <a href={`#pertemuan-${m.meeting_number}`} className="crumb-link">
                                  #{m.meeting_number}
                                </a>
                              </td>
                              <td>
                                {new Date(m.meeting_date + "T00:00:00").toLocaleDateString(
                                  "id-ID",
                                  { day: "2-digit", month: "long", year: "numeric" }
                                )}
                              </td>
                              <td>{m.type}</td>
                              <td>
                                <Tag kind={tagMeta?.kind ?? "neutral"}>
                                  {tagMeta?.label ?? "Belum Absen"}
                                </Tag>
                              </td>
                              <td>
                                {taskCount ? (
                                  <a href={`#pertemuan-${m.meeting_number}`} className="crumb-link">
                                    {taskCount} Tugas
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="subtle tiny">Belum ada data pertemuan tercatat.</p>
                )}

                <div style={{ marginTop: 16 }}>
                  <div className="stat-line">
                    <span>Kehadiran minimal mengikuti ujian</span>
                    <strong>75%</strong>
                  </div>
                  <Progress value={attendancePct} />
                </div>

                {myGrade && finalSummary ? (
                  <div style={{ marginTop: 18 }}>
                    <div className="panelhead" style={{ marginBottom: 10 }}>
                      <h3 style={{ margin: 0 }}>Ringkasan Komponen Nilai</h3>
                      <Tag kind="blue">
                        Akhir: {finalSummary.numeric.toFixed(2)} ({finalSummary.letter})
                      </Tag>
                    </div>
                    <div className="three-col">
                      <div className="stat-line">
                        <span>Kehadiran</span>
                        <strong>{myGrade.score_attendance}</strong>
                      </div>
                      <div className="stat-line">
                        <span>Tugas Harian</span>
                        <strong>{myGrade.score_daily_task}</strong>
                      </div>
                      <div className="stat-line">
                        <span>Tugas Kelompok</span>
                        <strong>{myGrade.score_group_task}</strong>
                      </div>
                      <div className="stat-line">
                        <span>Tugas Besar</span>
                        <strong>{myGrade.score_major_project}</strong>
                      </div>
                      <div className="stat-line">
                        <span>UTS</span>
                        <strong>{myGrade.score_uts}</strong>
                      </div>
                      <div className="stat-line">
                        <span>UAS</span>
                        <strong>{myGrade.score_uas}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="field-hint" style={{ marginTop: 14 }}>
                    Komponen nilai PAP belum diterbitkan oleh dosen pengampu.
                  </p>
                )}

                <div className="form-actions">
                  <Link href={`/kelas/${classId}/raport`} className="btn btn-secondary btn-sm">
                    <i className="bi bi-file-earmark-bar-graph" /> Buka E-Raport OBE
                  </Link>
                </div>
              </>
            ) : (
              <>
                {meetings.length ? (
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Pertemuan</th>
                          <th>Tanggal</th>
                          <th>Hadir</th>
                          <th>Izin/Sakit</th>
                          <th>Alpha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meetings.map((m) => {
                          const map = rosterAttendanceMap.get(m.id) ?? {};
                          const vals = Object.values(map);
                          const h = vals.filter((v) => v === "HADIR").length;
                          const is = vals.filter((v) => v === "IZIN" || v === "SAKIT").length;
                          const a = vals.filter((v) => v === "ALPHA").length;
                          return (
                            <tr key={m.id}>
                              <td>
                                <a href={`#pertemuan-${m.meeting_number}`} className="crumb-link">
                                  #{m.meeting_number} ({m.type})
                                </a>
                              </td>
                              <td>{m.meeting_date}</td>
                              <td>
                                <Tag kind="good">{h}</Tag>
                              </td>
                              <td>{is}</td>
                              <td>{a}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="subtle tiny">Belum ada pertemuan tercatat.</p>
                )}
                <div className="form-actions">
                  <Link href={`/kelas/${classId}/nilai`} className="btn btn-primary btn-sm">
                    <i className="bi bi-clipboard2-data" /> Input / Perbarui Nilai Mahasiswa
                  </Link>
                  <Link href={`/kelas/${classId}/rps`} className="btn btn-secondary btn-sm">
                    <i className="bi bi-diagram-3" /> Kelola RPS &amp; OBE
                  </Link>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panelhead">
              <h2>Tugas Kelas Ini</h2>
              <Link href={`/tugas?classId=${classId}`} className="section-link">
                Semua ({classTasks.length})
              </Link>
            </div>
            {classTasks.length ? (
              <div className="ref-list">
                {classTasks.slice(0, 6).map((t) => (
                  <div className="stat-line" key={t.id}>
                    <Link
                      href={`/tugas/${t.id}`}
                      className="crumb-link"
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.meetings ? `P#${t.meetings.meeting_number} · ` : ""}
                      {t.title}
                    </Link>
                    <Link href={`/tugas/${t.id}`} className="btn btn-secondary btn-sm">
                      Buka
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="subtle tiny" style={{ margin: 0 }}>
                Belum ada tugas kelas. Tambah langsung dari pertemuan atau halaman Tugas.
              </p>
            )}
            <div className="form-actions">
              <Link href={`/tugas?classId=${classId}`} className="btn btn-primary btn-sm">
                <i className="bi bi-plus-circle" /> Kelola / Tambah Tugas
              </Link>
            </div>
          </section>

          <section className="panel">
            <div className="panelhead">
              <h2>Informasi Kelas</h2>
            </div>
            <div className="stat-line">
              <span>Dosen pengampu</span>
              <strong style={{ textAlign: "right" }}>{klass.lecturer_directory.full_name}</strong>
            </div>
            <div className="stat-line">
              <span>NIDN / Kode</span>
              <strong>{klass.lecturer_identity_number}</strong>
            </div>
            <div className="stat-line">
              <span>Hari / Jam</span>
              <strong>
                {klass.schedule_day} · {klass.start_time.slice(0, 5)}–{klass.end_time.slice(0, 5)}
              </strong>
            </div>
            <div className="stat-line">
              <span>Ruangan</span>
              <strong>{klass.room_name}</strong>
            </div>
            <div className="stat-line">
              <span>Rekap peserta PRD</span>
              <strong>{klass.initial_student_count} orang</strong>
            </div>
            <div className="stat-line">
              <span>Target mutu</span>
              <strong>{klass.courses.passing_grade_target.toFixed(2)} / 4.00</strong>
            </div>
            <div className="stat-line">
              <span>Jadwal UTS</span>
              <strong>
                {klass.uts_schedule
                  ? new Date(klass.uts_schedule).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })
                  : "Belum diumumkan"}
              </strong>
            </div>
            <div className="stat-line">
              <span>Jadwal UAS</span>
              <strong>
                {klass.uas_schedule
                  ? new Date(klass.uas_schedule).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })
                  : "Belum diumumkan"}
              </strong>
            </div>
          </section>

          <section className="panel">
            <div className="panelhead">
              <h2>Progres Perkuliahan</h2>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "end",
                marginBottom: 12,
              }}
            >
              <span className="subtle tiny">Berdasarkan rekap &amp; sesi digital</span>
              <strong>
                {meetingDoneCount} / {klass.rps_target_meetings}
              </strong>
            </div>
            <Progress value={Math.min(100, (meetingDoneCount / klass.rps_target_meetings) * 100)} />
            <div className="notice" style={{ marginTop: 20 }}>
              <i className="bi bi-info-circle" />
              <div>
                <strong>Ketentuan sesi</strong>
                <p>
                  Pertemuan terkunci otomatis setelah jam selesai. Presensi mandiri hanya aktif
                  saat sesi LIVE.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
