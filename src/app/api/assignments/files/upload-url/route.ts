import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import {
  ATTACHMENT_BUCKET,
  MAX_ATTACHMENT_BYTES,
  attachmentMimeForName,
} from "@/lib/assignments/attachments";

export const runtime = "nodejs";

const schema = z.object({
  targetId: z.uuid(),
  kind: z.enum(["submission", "material"]),
  fileName: z.string().trim().min(1).max(160),
  byteSize: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
});

export async function POST(req: Request) {
  try {
    const { db, profile } = await apiSession();
    const body = schema.parse(await boundedJson(req, 4000));

    const format = attachmentMimeForName(body.fileName);
    if (!format) {
      throw new Error(
        "Format file tidak didukung. Gunakan PDF, Word (.doc/.docx), Excel, PPT, ZIP/RAR/7z, gambar, atau catatan teks."
      );
    }

    let assignmentId: string;
    let ownerId: string;

    if (body.kind === "submission") {
      if (profile.role !== "mahasiswa") {
        throw new Error("Hanya mahasiswa dapat mengunggah pengumpulan.");
      }
      const { data: submission, error } = await db
        .from("assignment_submissions")
        .select("id,assignment_id,student_id,assignments!inner(due_at,accept_late,published)")
        .eq("id", body.targetId)
        .maybeSingle();
      if (error || !submission || submission.student_id !== profile.id) {
        throw new Error("Pengumpulan tidak ditemukan.");
      }
      const task = Array.isArray(submission.assignments)
        ? submission.assignments[0]
        : submission.assignments;
      if (!task?.published || (!task.accept_late && new Date(task.due_at) <= new Date())) {
        throw new Error("Pengumpulan telah ditutup.");
      }
      assignmentId = submission.assignment_id;
      ownerId = profile.id;
    } else {
      if (
        profile.role !== "dosen" &&
        profile.role !== "admin" &&
        profile.role !== "super_admin"
      ) {
        throw new Error("Hanya pengelola tugas yang dapat mengunggah materi.");
      }
      const { data: assignment, error } = await db
        .from("assignments")
        .select("id,class_id,classes!inner(lecturer_identity_number)")
        .eq("id", body.targetId)
        .maybeSingle();
      if (error || !assignment) throw new Error("Tugas tidak ditemukan.");
      const klass = Array.isArray(assignment.classes)
        ? assignment.classes[0]
        : assignment.classes;
      if (
        profile.role === "dosen" &&
        klass?.lecturer_identity_number !== profile.identity_number
      ) {
        throw new Error("Bukan pengampu kelas ini.");
      }
      assignmentId = assignment.id;
      ownerId = "materials";
    }

    const storagePath = `${assignmentId}/${ownerId}/${randomUUID()}.${format.extension}`;
    const admin = adminClient();
    const { data, error: signErr } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signErr || !data?.token) {
      throw new Error("Gagal menyiapkan URL unggahan lampiran.");
    }

    return NextResponse.json({
      ok: true,
      path: data.path,
      token: data.token,
      mime: format.mime,
    });
  } catch (e) {
    return apiError(e);
  }
}
