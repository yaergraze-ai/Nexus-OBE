import { sessionContext } from "@/lib/auth";
import { readAssignmentsBoard, readClasses, readMeetingsByClasses } from "@/lib/data";
import { SectionHead } from "@/components/UI";
import { TaskBoard } from "@/components/TaskBoard";
import type { Submission, SubmissionStat } from "@/types/coursework";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { classId } = await searchParams;
  const { db, profile } = await sessionContext();
  const [all, allAssignments, enrollRows] = await Promise.all([
    readClasses(db),
    readAssignmentsBoard(db, undefined, { id: profile.id, role: profile.role }),
    profile.role === "mahasiswa"
      ? db.from("class_enrollments").select("class_id").eq("student_id", profile.id)
      : Promise.resolve({ data: [] }),
  ]);

  const enrolled = new Set((enrollRows.data ?? []).map((r) => r.class_id));
  const classes =
    profile.role === "dosen"
      ? all.filter((c) => c.lecturer_identity_number === profile.identity_number)
      : profile.role === "mahasiswa"
        ? all.filter((c) => enrolled.has(c.id))
        : all;

  const classIdSet = new Set(classes.map((c) => c.id));
  const assignments = allAssignments.filter((a) => classIdSet.has(a.class_id));
  const assignmentIds = assignments.map((a) => a.id);

  const [meetings, subRows] = await Promise.all([
    readMeetingsByClasses(db, classes.map((c) => c.id)),
    profile.role === "mahasiswa"
      ? db.from("assignment_submissions").select("*").eq("student_id", profile.id)
      : assignmentIds.length
        ? db
            .from("assignment_submissions")
            .select("assignment_id,status,score")
            .in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [] }),
  ]);

  const submissionStats: Record<string, SubmissionStat> = {};
  if (profile.role !== "mahasiswa") {
    for (const s of (subRows.data ?? []) as {
      assignment_id: string;
      status: string;
      score: number | null;
    }[]) {
      if (s.status !== "SUBMITTED") continue;
      const prev = submissionStats[s.assignment_id] ?? { total: 0, ungraded: 0, graded: 0 };
      prev.total += 1;
      if (s.score == null) prev.ungraded += 1;
      else prev.graded += 1;
      submissionStats[s.assignment_id] = prev;
    }
  }

  const validInitialClass =
    classId && classes.some((c) => c.id === classId) ? classId : "";

  return (
    <>
      <SectionHead
        eyebrow="AKTIVITAS AKADEMIK"
        title="Tugas & Pengumpulan"
        subtitle="Tugas dari dosen dan mahasiswa pada pertemuan kelas terhubung langsung untuk pengumpulan file dan penilaian PAP."
      />
      <TaskBoard
        assignments={assignments}
        classes={classes}
        meetings={meetings}
        submissions={
          profile.role === "mahasiswa"
            ? ((subRows.data ?? []) as Submission[])
            : []
        }
        submissionStats={submissionStats}
        role={profile.role}
        currentUserId={profile.id}
        initialClassId={validInitialClass}
      />
    </>
  );
}
