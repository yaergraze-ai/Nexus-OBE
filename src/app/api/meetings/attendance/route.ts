import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";

const schema = z.object({
  meetingId: z.uuid(),
  studentId: z.uuid(),
  status: z.enum(["HADIR", "IZIN", "SAKIT", "ALPHA"]),
});

export async function POST(req: Request) {
  try {
    const { db, profile } = await apiSession(["dosen", "admin", "super_admin"]);
    const body = schema.parse(await boundedJson(req));

    const { data: meeting, error: meetErr } = await db
      .from("meetings")
      .select("id,class_id,classes!inner(lecturer_identity_number)")
      .eq("id", body.meetingId)
      .maybeSingle();
    if (meetErr || !meeting) throw new Error("Pertemuan tidak ditemukan.");

    const lecturerIdentity = Array.isArray(meeting.classes)
      ? meeting.classes[0]?.lecturer_identity_number
      : (meeting.classes as { lecturer_identity_number?: string } | null)?.lecturer_identity_number;

    if (profile.role === "dosen" && lecturerIdentity !== profile.identity_number) {
      return apiError(new Error("Anda bukan dosen pengampu kelas ini."), 403);
    }

    const admin = adminClient();
    const { data: enrolled } = await admin
      .from("class_enrollments")
      .select("id")
      .eq("class_id", meeting.class_id)
      .eq("student_id", body.studentId)
      .maybeSingle();
    if (!enrolled) {
      throw new Error("Mahasiswa tidak terdaftar pada KRS kelas ini.");
    }

    const rpc = await db.rpc("mark_student_attendance", {
      p_meeting_id: body.meetingId,
      p_student_id: body.studentId,
      p_status: body.status,
    });

    if (rpc.error) {
      if (!/could not find the function|mark_student_attendance/i.test(rpc.error.message)) {
        throw new Error(rpc.error.message);
      }
      const { error: upsertErr } = await admin.from("attendances").upsert(
        {
          meeting_id: body.meetingId,
          student_id: body.studentId,
          status: body.status,
          checked_in_at: new Date().toISOString(),
        },
        { onConflict: "meeting_id,student_id" }
      );
      if (upsertErr) throw new Error(upsertErr.message);

      await admin.from("audit_logs").insert({
        actor_id: profile.id,
        action: "ATTENDANCE_MARKED",
        target_table: "attendances",
        target_id: body.meetingId,
        metadata: { student_id: body.studentId, status: body.status },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
