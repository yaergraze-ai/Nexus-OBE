import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import { safeExternalUrl } from "@/lib/assignments/links";
import { MEETING_REF_BUCKET } from "@/lib/assignments/attachments";

export const runtime = "nodejs";

const saveSchema = z.object({
  id: z.uuid().optional(),
  meetingId: z.uuid(),
  title: z.string().trim().min(2, "Judul referensi minimal 2 karakter.").max(220),
  citation: z.string().trim().max(1000).optional().default(""),
  referenceUrl: z.string().trim().max(2048).optional().nullable(),
  notes: z.string().trim().max(2000).optional().default(""),
});

const deleteSchema = z.object({
  referenceId: z.uuid(),
});

export async function POST(req: Request) {
  try {
    const { db } = await apiSession(["dosen", "admin", "super_admin"]);
    const body = saveSchema.parse(await boundedJson(req, 16000));
    const url = body.referenceUrl?.trim() || null;
    if (url && !safeExternalUrl(url)) {
      throw new Error("Tautan referensi wajib berupa alamat HTTPS publik yang valid.");
    }

    const { data: id, error } = await db.rpc("save_meeting_reference", {
      p_id: body.id ?? null,
      p_meeting_id: body.meetingId,
      p_title: body.title,
      p_citation: body.citation,
      p_url: url,
      p_notes: body.notes,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await apiSession(["dosen", "admin", "super_admin"]);
    const body = deleteSchema.parse(await boundedJson(req, 4000));
    const { data: paths, error } = await db.rpc("delete_meeting_reference", {
      p_reference_id: body.referenceId,
    });
    if (error) throw new Error(error.message);

    const list = Array.isArray(paths) ? (paths as string[]).filter(Boolean) : [];
    if (list.length) {
      await adminClient().storage.from(MEETING_REF_BUCKET).remove(list);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

