import Link from "next/link";
import { sessionContext } from "@/lib/auth";
import { readClasses, readMeetingsByClasses } from "@/lib/data";
import { calculateFinal } from "@/lib/utils/grade-calculator";
import { Metric, Progress, SectionHead, Tag, ValidationStatus } from "@/components/UI";
import type { Grade } from "@/types/domain";

export default async function GradesHome() {
  const { db, profile } = await sessionContext();
  const all = await readClasses(db);

  if (profile.role === "mahasiswa") {
    const [{ data: enrollRows }, { data: gradeRows }, { data: attRows }] =
      await Promise.all([
        db.from("class_enrollments").select("class_id").eq("student_id", profile.id),
        db.from("grades").select("*").eq("student_id", profile.id),
        db
          .from("attendances")
          .select("meeting_id,status")
          .eq("student_id", profile.id),
      ]);

    const enrolledIds = new Set((enrollRows ?? []).map((e) => e.class_id));
    const classes = all.filter((c) => enrolledIds.has(c.id));
    const meetings = await readMeetingsByClasses(
      db,
      classes.map((c) => c.id)
    );
    const attByMeeting = new Map(
      (attRows ?? []).map((a) => [a.meeting_id, a.status])
    );
    const gradeByClass = new Map(
      ((gradeRows ?? []) as Grade[]).map((g) => [g.class_id, g])
    );

    const totalSks = classes.reduce((s, c) => s + Number(c.courses.sks_total), 0);
    const rpsValidCount = classes.filter(
      (c) => c.rps_validated_kaprodi && c.rps_validated_dekan
    ).length;

    let gradedSks = 0;
    let weightedPoints = 0;
    let totalMeetingsAll = 0;
    let totalHadirAll = 0;

    const rows = classes.map((c) => {
      const classMeetings = meetings.filter((m) => m.class_id === c.id);
      const hadir = classMeetings.filter(
        (m) => attByMeeting.get(m.id) === "HADIR"
      ).length;
      totalMeetingsAll += classMeetings.length;
      totalHadirAll += hadir;
      const attPct = classMeetings.length
        ? Math.round((hadir / classMeetings.length) * 100)
        : 0;

      const grade = gradeByClass.get(c.id);
      const final = grade
        ? calculateFinal(
            {
              attendance: grade.score_attendance,
              uts: grade.score_uts,
              uas: grade.score_uas,
              daily_task: grade.score_daily_task,
              group_task: grade.score_group_task,
              major_project: grade.score_major_project,
            },
            {
              attendance: c.weight_attendance,
              uts: c.weight_uts,
              uas: c.weight_uas,
              daily_task: c.weight_daily_task,
              group_task: c.weight_group_task,
              major_project: c.weight_major_project,
            }
          )
        : null;

      if (final) {
        gradedSks += Number(c.courses.sks_total);
        weightedPoints += final.quality * Number(c.courses.sks_total);
      }

      return { klass: c, totalMtgs: classMeetings.length, hadir, attPct, grade, final };
    });

    const ips =
      gradedSks > 0 ? (weightedPoints / gradedSks).toFixed(2) : "—";
    const avgAtt =
      totalMeetingsAll > 0
        ? Math.round((totalHadirAll / totalMeetingsAll) * 100)
        : 0;

    return (
      <>
        <SectionHead
          eyebrow="REKAP AKADEMIK MAHASISWA"
          title="Nilai, SKS & IPS Sementara"
          subtitle="Rekap beban SKS, validasi RPS, kehadiran per kelas, dan Indeks Prestasi Semester (PAP)."
        />

        <div className="metrics">
          <Metric
            icon="graph-up-arrow"
            label="IPS Sementara"
            value={ips}
            note={
              gradedSks > 0
                ? `Dari ${gradedSks} SKS bernilai`
                : "Menunggu input nilai dosen"
            }
          />
          <Metric
            icon="layers"
            label="Total SKS KRS"
            value={`${totalSks} SKS`}
            note={`${classes.length} mata kuliah aktif`}
            href="/kelas"
          />
          <Metric
            icon="patch-check-fill"
            label="RPS Tervalidasi"
            value={`${rpsValidCount}/${classes.length}`}
            note="Kurikulum OBE siap diakses"
          />
          <Metric
            icon="person-check-fill"
            label="Rata-rata Kehadiran"
            value={`${avgAtt}%`}
            note={`${totalHadirAll} dari ${totalMeetingsAll} pertemuan`}
          />
        </div>

        <div className="panel tight">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Mata Kuliah &amp; Kelas</th>
                  <th>SKS</th>
                  <th>Status RPS</th>
                  <th>Kehadiran</th>
                  <th>Nilai Akhir</th>
                  <th>Mutu</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ klass: c, totalMtgs, hadir, attPct, final }) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/kelas/${c.id}`} className="crumb-link">
                        <strong>{c.courses.name_id}</strong>
                      </Link>
                      <div className="tiny subtle">
                        {c.courses.course_code} · {c.class_code} · {c.lecturer_directory.full_name}
                      </div>
                    </td>
                    <td>
                      <strong>{c.courses.sks_total}</strong> SKS
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: 6 }}>
                        <ValidationStatus
                          kaprodi={c.rps_validated_kaprodi}
                          dekan={c.rps_validated_dekan}
                        />
                        <Link href={`/kelas/${c.id}/rps`} className="tiny crumb-link">
                          Lihat RPS OBE
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div className="tiny" style={{ marginBottom: 4 }}>
                        {hadir}/{totalMtgs} ({attPct}%)
                      </div>
                      <Progress value={attPct} />
                    </td>
                    <td>
                      <strong>{final ? final.numeric.toFixed(2) : "—"}</strong>
                    </td>
                    <td>
                      {final ? (
                        <Tag
                          kind={
                            final.quality >= c.courses.passing_grade_target
                              ? "good"
                              : "bad"
                          }
                        >
                          {final.letter} ({final.quality.toFixed(2)})
                        </Tag>
                      ) : (
                        <Tag kind="neutral">Belum Dinilai</Tag>
                      )}
                    </td>
                    <td>
                      <div className="chip-row">
                        <Link
                          href={`/kelas/${c.id}/raport`}
                          className="btn btn-secondary btn-sm"
                        >
                          E-Raport
                        </Link>
                        <Link href={`/kelas/${c.id}`} className="btn btn-primary btn-sm">
                          Detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  const classes =
    profile.role === "dosen"
      ? all.filter((c) => c.lecturer_identity_number === profile.identity_number)
      : all;

  return (
    <>
      <SectionHead
        eyebrow="EVALUASI AKADEMIK"
        title="Input Nilai Mahasiswa"
        subtitle="Pilih kelas untuk mengisi enam komponen nilai akhir PAP atau pantau E-Raport."
      />
      <div className="panel tight">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Mata Kuliah</th>
                <th>Kelas &amp; SKS</th>
                <th>Dosen</th>
                <th>Target Mutu</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.courses.name_id}</strong>
                  </td>
                  <td>
                    {c.class_code} · {c.courses.sks_total} SKS
                  </td>
                  <td>{c.lecturer_directory.full_name}</td>
                  <td>
                    <Tag kind="blue">{c.courses.passing_grade_target.toFixed(2)}</Tag>
                  </td>
                  <td>
                    <div className="chip-row">
                      <Link
                        href={`/kelas/${c.id}/nilai`}
                        className="btn btn-primary btn-sm"
                      >
                        Kelola Nilai <i className="bi bi-arrow-up-right" />
                      </Link>
                      <Link
                        href={`/kelas/${c.id}/raport`}
                        className="btn btn-secondary btn-sm"
                      >
                        E-Raport
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
