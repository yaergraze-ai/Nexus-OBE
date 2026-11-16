import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import {
  MAX_REFERENCE_FILE_BYTES,
  MEETING_REF_BUCKET,
  REFERENCE_FORMATS,
} from "@/lib/assignments/attachments";

export const runtime = "nodejs";

const schema = z.object({
  referenceId: z.uuid(),
  fileName: z.string().trim().min(1).max(180),
  byteSize: z.number().int().min(1).max(MAX_REFERENCE_FILE_BYTES),
});

export async function POST(req: Request) {
  try {
    const { db, profile } = await apiSession(["dosen", "admin", "super_admin"]);
    const body = schema.parse(await boundedJson(req, 4000));

    const ext = body.fileName.toLowerCase().split(".").pop() ?? "";
    const mime = REFERENCE_FORMATS[ext];
    if (!mime) {
      throw new Error(
        "Format berkas tidak didukung. Gunakan PDF, Word (.doc/.docx), ZIP/RAR/7z, Office, gambar, atau catatan teks/BibTeX."
      );
    }

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

    const path = `${refRow.class_id}/${refRow.meeting_id}/${randomUUID()}.${ext}`;
    const { data, error } = await adminClient()
      .storage.from(MEETING_REF_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new Error(error?.message || "Gagal menyiapkan unggahan berkas.");
    }

    return NextResponse.json({
      ok: true,
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      mime,
    });
  } catch (e) {
    return apiError(e);
  }
}
