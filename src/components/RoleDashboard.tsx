import { sessionContext } from "@/lib/auth";
import { readAssignmentsBoard, readClasses, readNotifications } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import type { DashboardInsight, DashboardTaskPreview } from "@/components/Dashboard";
import type { Role } from "@/types/domain";
import type { Announcement } from "@/types/coursework";
import { redirect } from "next/navigation";

export async function RoleDashboard({ role }: { role: Role }) {
  const { db, profile } = await sessionContext();
  if (profile.role !== role) redirect("/dashboard");

  const [all, notifications, announcementRows, meetingCount, enrollRows] =
    await Promise.all([
      readClasses(db),
      readNotifications(db, profile.id),
      db
        .from("announcements")
        .select("id,title,body,created_at")
        .order("created_at", { ascending: false })
        .limit(3),
      db.from("meetings").select("id", { count: "exact", head: true }),
      role === "mahasiswa"
        ? db.from("class_enrollments").select("class_id").eq("student_id", profile.id)
        : Promise.resolve({ data: null }),
    ]);

  const enrolledIds = new Set((enrollRows.data ?? []).map((e) => e.class_id));
  const classes =
    role === "dosen"
      ? all.filter((c) => c.lecturer_identity_number === profile.identity_number)
      : role === "mahasiswa"
        ? all.filter((c) => enrolledIds.has(c.id))
        : all;

  const classIds = classes.map((c) => c.id);
  const classIdSet = new Set(classIds);
  const showRecentTasks = role === "mahasiswa" || role === "dosen";
  const visibleAssignments = showRecentTasks
    ? (await readAssignmentsBoard(db, undefined, { id: profile.id, role: profile.role })).filter(
        (a) => classIdSet.has(a.class_id)
      )
    : [];
  const recentTasks: DashboardTaskPreview[] = visibleAssignments.slice(0, 6).map((a) => ({
    id: a.id,
    title: a.title,
    due_at: a.due_at,
    class_id: a.class_id,
  }));

  let ips: number | null = null;
  const insights: DashboardInsight[] = [];

  if (role === "mahasiswa") {
    const [{ data: gradeRows }, { data: submissions }] = await Promise.all([
      db
        .from("vw_student_final_grades")
        .select("class_id,quality_point")
        .eq("student_id", profile.id),
      db
        .from("assignment_submissions")
        .select("assignment_id,status")
        .eq("student_id", profile.id),
    ]);

    const summed = (gradeRows ?? []).reduce(
      (acc, g) => {
        const found = classes.find((c) => c.id === g.class_id);
        return found
          ? {
              weighted: acc.weighted + Number(g.quality_point) * found.courses.sks_total,
              sks: acc.sks + found.courses.sks_total,
            }
          : acc;
      },
      { weighted: 0, sks: 0 }
    );
    ips = summed.sks > 0 ? Math.round((summed.weighted / summed.sks) * 100) / 100 : null;

    const done = new Set(
      (submissions ?? [])
        .filter((x) => x.status === "SUBMITTED")
        .map((x) => x.assignment_id)
    );
    const open = visibleAssignments.filter((t) => t.published && !done.has(t.id));

    insights.push({
      label: "Tugas Perlu Dikumpulkan",
      value: open.length,
      description: "Buka soal & unggah file",
      href: "/tugas",
      icon: "clipboard2-check",
    });
    insights.push({
      label: "Tugas Sudah Terkumpul",
      value: done.size,
      description: "Lihat revisi & nilai",
      href: "/tugas",
      icon: "check2-circle",
    });
    insights.push({
      label: "Jadwal Kuliah Aktif",
      value: `${classes.length} Kelas`,
      description: "Jadwal mingguan & ujian",
      href: "/jadwal",
      icon: "calendar3",
    });
    insights.push({
      label: "Transkrip & IPS",
      value: ips == null ? "Lihat" : ips.toFixed(2),
      description: "Rincian SKS, presensi & mutu",
      href: "/nilai",
      icon: "graph-up-arrow",
    });
  } else if (role === "dosen") {
    const { data: taskRows } = classIds.length
      ? await db.from("assignments").select("id").in("class_id", classIds)
      : { data: [] as { id: string }[] };
    const taskIds = (taskRows ?? []).map((t) => t.id);
    const { data: submissionRows } = taskIds.length
      ? await db
          .from("assignment_submissions")
          .select("id,status,score")
          .in("assignment_id", taskIds)
      : { data: [] as { id: string; status: string; score: number | null }[] };

    insights.push({
      label: "Tugas Diampu",
      value: taskIds.length,
      description: "Tugas dosen & mahasiswa",
      href: "/tugas",
      icon: "journal-plus",
    });
    insights.push({
      label: "Belum Dinilai",
      value: (submissionRows ?? []).filter(
        (s) => s.status === "SUBMITTED" && s.score == null
      ).length,
      description: "Periksa & nilai kiriman",
      href: "/tugas",
      icon: "clipboard-data",
    });
    insights.push({
      label: "Input Nilai PAP",
      value: `${classes.length} Kelas`,
      description: "Nilai 6 komponen mahasiswa",
      href: "/nilai",
      icon: "clipboard2-check",
    });
    insights.push({
      label: "RPS Menunggu Validasi",
      value: classes.filter(
        (c) => !c.rps_validated_kaprodi || !c.rps_validated_dekan
      ).length,
      description: "Lengkapi & ajukan RPS OBE",
      href: classes[0] ? `/kelas/${classes[0].id}/rps` : "/kelas",
      icon: "patch-exclamation",
    });
  } else if (role === "admin") {
    const [{ data: studentRows }, { data: tasks }] = await Promise.all([
      db.from("profiles").select("id").eq("role", "mahasiswa").eq("is_active", true),
      db.from("assignments").select("id"),
    ]);
    insights.push({
      label: "RPS & Kontrol PBM",
      value: classes.filter(
        (c) => !c.rps_validated_kaprodi || !c.rps_validated_dekan
      ).length,
      description: "Persetujuan Kaprodi / Dekan",
      href: "/rps-review",
      icon: "patch-exclamation",
    });
    insights.push({
      label: "Mahasiswa Aktif",
      value: studentRows?.length ?? 0,
      description: "Kelola peserta KRS",
      href: "/krs",
      icon: "people",
    });
    insights.push({
      label: "Tugas Dipublikasikan",
      value: tasks?.length ?? 0,
      description: "Pantau pengumpulan kelas",
      href: "/tugas",
      icon: "clipboard2-check",
    });
    insights.push({
      label: "Jadwal & Bentrok",
      value: classes.length,
      description: "Edit jadwal ruang & ujian",
      href: "/jadwal",
      icon: "calendar-check",
    });
  } else {
    const [{ data: profiles }, { data: auditRows }, { data: tasks }] = await Promise.all([
      db.from("profiles").select("id,role,is_active"),
      db.from("audit_logs").select("id").order("created_at", { ascending: false }).limit(200),
      db.from("assignments").select("id"),
    ]);
    insights.push({
      label: "Akun Aktif",
      value: (profiles ?? []).filter((p) => p.is_active).length,
      description: "Kelola peran & status akun",
      href: "/pengguna",
      icon: "people-fill",
    });
    insights.push({
      label: "Log Keamanan",
      value: auditRows?.length ?? 0,
      description: "200 entri terkini maksimal",
      href: "/audit",
      icon: "shield-lock",
    });
    insights.push({
      label: "Validasi RPS & PBM",
      value: classes.filter(
        (c) => !c.rps_validated_kaprodi || !c.rps_validated_dekan
      ).length,
      description: "Otorisasi RPS & kontrol PBM",
      href: "/rps-review",
      icon: "patch-check",
    });
    insights.push({
      label: "Peserta KRS",
      value: `${classes.length} Kelas`,
      description: "Sinkronisasi KRS mahasiswa",
      href: "/krs",
      icon: "calendar3",
    });
    insights.push({
      label: "Total Tugas",
      value: tasks?.length ?? 0,
      description: "Kontrol operasional tugas",
      href: "/tugas",
      icon: "clipboard2-data",
    });
  }

  const [liveRes, aalRes] = await Promise.all([
    classIds.length
      ? db
          .from("meetings")
          .select("*")
          .in("class_id", classIds)
          .eq("status", "LIVE")
          .gt("ends_at", new Date().toISOString())
          .limit(20)
      : Promise.resolve({ data: [] }),
    db.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  return (
    <Dashboard
      profile={profile}
      classes={classes}
      notifications={notifications}
      ips={ips}
      liveMeetings={liveRes.data ?? []}
      insights={insights}
      announcements={(announcementRows.data ?? []) as unknown as Announcement[]}
      recentTasks={recentTasks}
      actualSessions={meetingCount.count ?? 0}
      mustChangePassword={Boolean(profile.must_change_password)}
      needsMfa={
        profile.role !== "mahasiswa" &&
        aalRes.data?.nextLevel === "aal2" &&
        aalRes.data?.currentLevel !== "aal2"
      }
    />
  );
}
