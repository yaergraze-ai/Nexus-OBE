import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import {
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_BUCKET,
  inspectAttachment,
  safeFileName,
} from "@/lib/assignments/attachments";
import { removeFileInput, uploadFileInput } from "@/lib/assignments/validation";

export const runtime = "nodejs";

const confirmSchema = z.object({
  targetId: z.uuid(),
  kind: z.enum(["submission", "material"]),
  path: z.string().trim().min(10).max(280),
  fileName: z.string().trim().min(1).max(160),
  byteSize: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
});

async function resolveFileTarget(
  db: Awaited<ReturnType<typeof apiSession>>["db"],
  profile: Awaited<ReturnType<typeof apiSession>>["profile"],
  kind: "submission" | "material",
  targetId: string
) {
  if (kind === "submission") {
    if (profile.role !== "mahasiswa") {
      throw new Error("Hanya mahasiswa dapat mengunggah pengumpulan.");
    }
    const { data: submission, error } = await db
      .from("assignment_submissions")
      .select("id,assignment_id,student_id,assignments!inner(due_at,accept_late,published)")
      .eq("id", targetId)
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
    return {
      assignmentId: submission.assignment_id,
      ownerId: profile.id,
      functionName: "attach_submission_file" as const,
    };
  }

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
    .eq("id", targetId)
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
  return {
    assignmentId: assignment.id,
    ownerId: "materials",
    functionName: "attach_assignment_file" as const,
  };
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const { db, profile } = await apiSession();
    const admin = adminClient();

    if (contentType.includes("application/json")) {
      const body = confirmSchema.parse(await boundedJson(req, 4000));
      const target = await resolveFileTarget(db, profile, body.kind, body.targetId);
      const expectedPrefix = `${target.assignmentId}/${target.ownerId}/`;
      if (!body.path.startsWith(expectedPrefix)) {
        throw new Error("Jalur penyimpanan berkas tidak valid.");
      }

      const { data: signed, error: signErr } = await admin.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(body.path, 60);
      if (signErr || !signed?.signedUrl) {
        throw new Error("Berkas belum tersedia pada penyimpanan.");
      }

      const headRes = await fetch(signed.signedUrl, {
        headers: { Range: "bytes=0-1023" },
      });
      if (!headRes.ok && headRes.status !== 206) {
        await admin.storage.from(ATTACHMENT_BUCKET).remove([body.path]);
        throw new Error("Gagal membaca isi berkas yang diunggah.");
      }

      const headerBytes = new Uint8Array(await headRes.arrayBuffer());
      const inspected = inspectAttachment(body.fileName, headerBytes, body.byteSize);
      if ("error" in inspected) {
        await admin.storage.from(ATTACHMENT_BUCKET).remove([body.path]);
        throw new Error(inspected.error);
      }

      const cleanName = safeFileName(body.fileName);
      const rpcArgs =
        target.functionName === "attach_submission_file"
          ? {
              p_submission_id: body.targetId,
              p_path: body.path,
              p_name: cleanName,
              p_mime: inspected.mime,
              p_size: body.byteSize,
            }
          : {
              p_assignment_id: body.targetId,
              p_path: body.path,
              p_name: cleanName,
              p_mime: inspected.mime,
              p_size: body.byteSize,
            };

      const { data: id, error } = await db.rpc(target.functionName, rpcArgs);
      if (error) {
        await admin.storage.from(ATTACHMENT_BUCKET).remove([body.path]);
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, id });
    }

    const length = Number(req.headers.get("content-length") || 0);
    if (length > MAX_ATTACHMENT_BYTES + 200_000) {
      throw new Error("Ukuran unggahan melewati 50 MB.");
    }
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Isi unggahan tidak tersedia.");
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ATTACHMENT_BYTES + 200_000) {
        await reader.cancel();
        throw new Error("Unggahan melampaui batas 50 MB.");
      }
      chunks.push(Buffer.from(value));
    }

    const bounded = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: Buffer.concat(chunks),
    });
    const form = await bounded.formData();
    const entry = uploadFileInput.parse({
      kind: form.get("kind"),
      targetId: form.get("targetId"),
    });
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Pilih berkas yang akan diunggah.");
    if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error("Maksimal 50 MB untuk setiap berkas.");
    }

    const target = await resolveFileTarget(db, profile, entry.kind, entry.targetId);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = inspectAttachment(file.name, bytes);
    if ("error" in inspected) throw new Error(inspected.error);

    const path = `${target.assignmentId}/${target.ownerId}/${randomUUID()}.${inspected.extension}`;
    const name = safeFileName(file.name);
    const { error: uploadError } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, bytes, {
        upsert: false,
        contentType: inspected.mime,
        cacheControl: "private, max-age=0",
      });
    if (uploadError) throw new Error(uploadError.message);

    const rpcArgs =
      target.functionName === "attach_submission_file"
        ? {
            p_submission_id: entry.targetId,
            p_path: path,
            p_name: name,
            p_mime: inspected.mime,
            p_size: file.size,
          }
        : {
            p_assignment_id: entry.targetId,
            p_path: path,
            p_name: name,
            p_mime: inspected.mime,
            p_size: file.size,
          };

    const { data: id, error } = await db.rpc(target.functionName, rpcArgs);
    if (error) {
      await admin.storage.from(ATTACHMENT_BUCKET).remove([path]);
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await apiSession();
    const entry = removeFileInput.parse(await boundedJson(req, 5000));
    const functionName =
      entry.kind === "submission" ? "remove_submission_file" : "remove_assignment_file";
    const { data: path, error } = await db.rpc(functionName, { p_file_id: entry.fileId });
    if (error) throw new Error(error.message);
    const { error: removeError } = await adminClient()
      .storage.from(ATTACHMENT_BUCKET)
      .remove([path as string]);
    if (removeError) {
      console.error("orphaned storage object requiring cleanup:", path, removeError.message);
    }
    return NextResponse.json({ ok: true, cleanupPending: Boolean(removeError) });
  } catch (e) {
    return apiError(e);
  }
}
