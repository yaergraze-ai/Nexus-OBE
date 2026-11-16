import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { readClasses, readTeachingRosterData } from "@/lib/data";
import { SectionHead } from "@/components/UI";
import { LecturerStudentsBoard } from "@/components/LecturerStudentsBoard";

export const metadata: Metadata = {
  title: "Mahasiswa Diampu",
};

export default async function LecturerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { db, profile } = await requireRole("dosen", "admin", "super_admin");
  const [{ classId }, all] = await Promise.all([searchParams, readClasses(db)]);

  const scopedClasses =
    profile.role === "dosen"
      ? all.filter((c) => c.lecturer_identity_number === profile.identity_number)
      : all;

  const roster = await readTeachingRosterData(scopedClasses, profile);

  return (
    <>
      <SectionHead
        eyebrow={profile.role === "dosen" ? "PESERTA KULIAH DOSEN" : "DIREKTORI PESERTA KELAS"}
        title={profile.role === "dosen" ? "Mahasiswa Diampu" : "Data Mahasiswa Kelas"}
        subtitle={
          profile.role === "dosen"
            ? `Total ${roster.students.length} mahasiswa unik (${roster.totalEnrollments} peserta kelas) yang Anda ampu pada TA 2026/2027 Ganjil.`
            : `Pantau distribusi ${roster.students.length} mahasiswa unik (${roster.totalEnrollments} keikutsertaan kelas) beserta kehadiran dan progres nilai.`
        }
      />
      <LecturerStudentsBoard
        role={profile.role}
        classes={scopedClasses}
        students={roster.students}
        classCounts={roster.classCounts}
        initialClassId={classId ?? ""}
      />
    </>
  );
}
