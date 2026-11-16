import { sessionContext } from "@/lib/auth";
import { readClasses } from "@/lib/data";
import { SectionHead } from "@/components/UI";
import { ClassList } from "@/components/ClassList";

export default async function ClassesPage() {
  const { db, profile } = await sessionContext();
  const [all, liveRes, taskRes, enrollRes] = await Promise.all([
    readClasses(db),
    db
      .from("meetings")
      .select("class_id")
      .eq("status", "LIVE")
      .gt("ends_at", new Date().toISOString()),
    db.from("assignments").select("class_id"),
    profile.role === "mahasiswa"
      ? db.from("class_enrollments").select("class_id").eq("student_id", profile.id)
      : Promise.resolve({ data: null }),
  ]);

  const classes =
    profile.role === "dosen"
      ? all.filter((c) => c.lecturer_identity_number === profile.identity_number)
      : all;

  const enrolledIds =
    profile.role === "mahasiswa"
      ? (enrollRes.data ?? []).map((e) => e.class_id)
      : undefined;

  const liveClassIds = [...new Set((liveRes.data ?? []).map((m) => m.class_id))];
  const taskCounts: Record<string, number> = {};
  for (const row of taskRes.data ?? []) {
    taskCounts[row.class_id] = (taskCounts[row.class_id] ?? 0) + 1;
  }

  return (
    <>
      <SectionHead
        eyebrow="KATALOG PERKULIAHAN"
        title="Kelas Kuliah"
        subtitle={`Daftar mata kuliah semester 2026/2027 Ganjil · ${classes.length} kelas`}
      />
      <ClassList
        classes={classes}
        enrolledIds={enrolledIds}
        liveClassIds={liveClassIds}
        taskCounts={taskCounts}
      />
    </>
  );
}
