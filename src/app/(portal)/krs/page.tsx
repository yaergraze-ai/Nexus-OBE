import { requireRole } from "@/lib/auth";
import { readClasses } from "@/lib/data";
import { SectionHead } from "@/components/UI";
import { KrsManager } from "@/components/KrsManager";
import type { Profile } from "@/types/domain";

export default async function KrsPage() {
  const { db } = await requireRole("admin", "super_admin");
  const [classes, studentsRes, enrollRes] = await Promise.all([
    readClasses(db),
    db
      .from("profiles")
      .select("*")
      .eq("role", "mahasiswa")
      .eq("is_active", true)
      .order("full_name"),
    db.from("class_enrollments").select("class_id,student_id,enrolled_at"),
  ]);

  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (enrollRes.error) throw new Error(enrollRes.error.message);

  return (
    <>
      <SectionHead
        eyebrow="MANAJEMEN AKADEMIK"
        title="Peserta KRS"
        subtitle="Kelola keanggotaan kelas mahasiswa, cek bentrok jadwal, atau sinkronkan peserta aktif ke jadwal non-bentrok."
      />
      <KrsManager
        classes={classes}
        students={(studentsRes.data ?? []) as Profile[]}
        enrollments={enrollRes.data ?? []}
      />
    </>
  );
}
