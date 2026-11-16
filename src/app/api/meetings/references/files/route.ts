import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import {
  MAX_REFERENCE_FILE_BYTES,
  MEETING_REF_BUCKET,
  inspectReferenceFile,
  safeFileName,
} from "@/lib/assignments/attachments";

export const runtime = "nodejs";

const attachSchema = z.object({
  referenceId: z.uuid(),
  path: z.string().trim().min(10).max(320),
  fileName: z.string().trim().min(1).max(180),
  byteSize: z.number().int().min(1).max(MAX_REFERENCE_FILE_BYTES),
});

const removeSchema = z.object({
  fileId: z.uuid(),
});

export async function POST(req: Request) {
  try {
    const { db, profile } = await apiSession(["dosen", "admin", "super_admin"]);
    const body = attachSchema.parse(await boundedJson(req, 4000));

    const { data: refRow, error: refErr } = await db
      .from("meeting_references")
      .select("id,meeting_id,class_id,classes!inner(lecturer_identity_number)")
      .eq("id", body.referenceId)
      .maybeSingle();
    if (refErr || !refRow) throw new Error("Referensi pertemuan tidak ditemukan.");

    const klass = Array.isArray(refRow.classes) ? refRow.classes[0] : refRow.classes;
    if (
      profile.role === "dosen" &&
      klass?.lecturer_identity_number !== profile.identity_number
    ) {
      throw new Error("Anda bukan dosen pengampu kelas ini.");
    }

    const expectedPrefix = `${refRow.class_id}/${refRow.meeting_id}/`;
    if (!body.path.startsWith(expectedPrefix)) {
      throw new Error("Jalur penyimpanan berkas tidak valid.");
    }

    const admin = adminClient();
    const { data: signed, error: signErr } = await admin.storage
      .from(MEETING_REF_BUCKET)
      .createSignedUrl(body.path, 60);
    if (signErr || !signed?.signedUrl) {
      throw new Error("Berkas belum tersedia pada penyimpanan.");
    }

    const headRes = await fetch(signed.signedUrl, {
      headers: { Range: "bytes=0-1023" },
    });
    if (!headRes.ok && headRes.status !== 206) {
      await admin.storage.from(MEETING_REF_BUCKET).remove([body.path]);
      throw new Error("Gagal membaca isi berkas yang diunggah.");
    }

    const headerBytes = new Uint8Array(await headRes.arrayBuffer());
    const inspected = inspectReferenceFile(body.fileName, headerBytes, body.byteSize);
    if ("error" in inspected) {
      await admin.storage.from(MEETING_REF_BUCKET).remove([body.path]);
      throw new Error(inspected.error);
    }

    const cleanName = safeFileName(body.fileName);
    const { data: fileId, error: rpcErr } = await db.rpc(
      "attach_meeting_reference_file",
      {
        p_reference_id: body.referenceId,
        p_path: body.path,
        p_name: cleanName,
        p_mime: inspected.mime,
        p_size: body.byteSize,
      }
    );
    if (rpcErr) {
      await admin.storage.from(MEETING_REF_BUCKET).remove([body.path]);
      throw new Error(rpcErr.message);
    }

    return NextResponse.json({ ok: true, id: fileId });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await apiSession(["dosen", "admin", "super_admin"]);
    const body = removeSchema.parse(await boundedJson(req, 4000));
    const { data: path, error } = await db.rpc("remove_meeting_reference_file", {
      p_file_id: body.fileId,
    });
    if (error) throw new Error(error.message);
    if (typeof path === "string" && path) {
      await adminClient().storage.from(MEETING_REF_BUCKET).remove([path]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

