import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { enrollStudentDefaultClasses } from "@/lib/security/auth-flow";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";

const singleSchema = z.object({ classId: z.uuid(), studentId: z.uuid() });
const postSchema = z.union([
  z.object({ action: z.literal("sync_all") }),
  singleSchema,
]);

export async function POST(req: Request) {
  try {
    const { db, profile } = await apiSession(["admin", "super_admin"]);
    const payload = postSchema.parse(await boundedJson(req));

    if ("action" in payload) {
      const admin = adminClient();
      const { data: students, error: stuErr } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "mahasiswa")
        .eq("is_active", true);
      if (stuErr) throw new Error(stuErr.message);

      let syncedStudents = 0;
      for (const s of students ?? []) {
        await enrollStudentDefaultClasses(admin, s.id);
        syncedStudents += 1;
      }

      await admin.from("audit_logs").insert({
        actor_id: profile.id,
        action: "ENROLLMENTS_SYNCED",
        target_table: "class_enrollments",
        metadata: { students_checked: syncedStudents },
      });

      return NextResponse.json({ ok: true, syncedStudents });
    }

    const { classId, studentId } = payload;
    const { data: student, error: studentError } = await db
      .from("profiles")
      .select("role,is_active")
      .eq("id", studentId)
      .single();
    if (studentError || student?.role !== "mahasiswa" || !student.is_active) {
      throw new Error("Akun mahasiswa tidak valid.");
    }

    const { error } = await db
      .from("class_enrollments")
      .upsert(
        { class_id: classId, student_id: studentId },
        { onConflict: "class_id,student_id", ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db, profile } = await apiSession(["admin", "super_admin"]);
    const { classId, studentId } = singleSchema.parse(await boundedJson(req));

    const { error } = await db
      .from("class_enrollments")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId);

    if (error) {
      // Fallback if 008 delete policy is not yet executed; already verified admin/super_admin via apiSession.
      const admin = adminClient();
      const fallback = await admin
        .from("class_enrollments")
        .delete()
        .eq("class_id", classId)
        .eq("student_id", studentId);
      if (fallback.error) throw new Error(fallback.error.message);
    }

    await adminClient().from("audit_logs").insert({
      actor_id: profile.id,
      action: "ENROLLMENT_REMOVED",
      target_table: "class_enrollments",
      target_id: studentId,
      metadata: { class_id: classId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
