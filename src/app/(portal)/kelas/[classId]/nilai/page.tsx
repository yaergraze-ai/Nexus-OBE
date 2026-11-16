import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sessionContext } from "@/lib/auth";
import { readClass, readMeetings, readStudents, readGrades } from "@/lib/data";
import { GradeEditor } from "@/components/GradeEditor";

export default async function GradePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { db, profile } = await sessionContext();
  const klass = await readClass(db, classId);
  if (!klass) notFound();

  const allowed =
    ["admin", "super_admin"].includes(profile.role) ||
    (profile.role === "dosen" &&
      profile.identity_number === klass.lecturer_identity_number);
  if (!allowed) redirect("/dashboard");

  const [students, grades, meetings] = await Promise.all([
    readStudents(db, classId),
    readGrades(db, classId),
    readMeetings(db, classId),
  ]);

  const meetingIds = meetings.map((m) => m.id);
  const { data: attRows } = meetingIds.length
    ? await db
        .from("attendances")
        .select("student_id,status")
        .in("meeting_id", meetingIds)
    : { data: [] as { student_id: string; status: string }[] };

  const attendanceRates: Record<string, number> = {};
  if (meetings.length > 0) {
    const counts = new Map<string, number>();
    for (const r of attRows ?? []) {
      if (r.status === "HADIR") {
        counts.set(r.student_id, (counts.get(r.student_id) ?? 0) + 1);
      }
    }
    for (const st of students) {
      attendanceRates[st.id] = Math.round(
        ((counts.get(st.id) ?? 0) / meetings.length) * 100
      );
    }
  }

  return (
    <>
      <div className="subtle tiny" style={{ marginBottom: 14 }}>
        <Link className="crumb-link" href="/nilai">
          Input Nilai
        </Link>{" "}
        / {klass.courses.name_id}
      </div>
      <div className="sectionhead">
        <div>
          <span className="kicker">EVALUASI MAHASISWA</span>
          <h1>Input Nilai · {klass.class_code}</h1>
          <p>
            {klass.courses.name_id} · {students.length} peserta terdaftar ·{" "}
            {meetings.length} pertemuan tercatat
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="panelhead">
          <h2>Penilaian Acuan Patokan</h2>
          <span className="subtle tiny">
            Skala 0–100, otomatis memperbarui IPS &amp; E-Raport mahasiswa saat Simpan
          </span>
        </div>
        <div className="notice" style={{ marginBottom: 16 }}>
          <i className="bi bi-info-circle" />
          <div>
            <strong>Terintegrasi presensi &amp; tugas</strong>
            <p>
              Nilai kehadiran riil dihitung dari rekap presensi pertemuan kelas. Bila sudah ada
              tugas yang dinilai pada kategori Harian, Kelompok, atau Besar, rata-rata nilai tugas
              otomatis terisi.
            </p>
          </div>
        </div>
        <GradeEditor
          classId={classId}
          students={students}
          grades={grades}
          target={klass.courses.passing_grade_target}
          attendanceRates={attendanceRates}
        />
      </section>
    </>
  );
}
