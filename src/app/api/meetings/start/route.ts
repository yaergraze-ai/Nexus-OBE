import { NextResponse } from "next/server";
import { apiSession } from "@/lib/security/api-session";
import { startMeetingSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";
import { classRecipientIds, deliver } from "@/lib/security/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let storedPath: string | null = null;
  try {
    if (Number(req.headers.get("content-length") || 0) > 700_000) {
      throw new Error("Ukuran formulir melebihi batas.");
    }
    const { db } = await apiSession(["dosen"]);
    const form = await req.formData();
    const info = startMeetingSchema.parse({
      classId: form.get("classId"),
      type: form.get("type"),
      summary: form.get("summary"),
    });

    const photo = form.get("photo");
    let finalPhotoPath = "";
    if (photo instanceof File && photo.size > 0) {
      if (photo.size < 16 || photo.size > 500_000 || photo.type !== "image/webp") {
        throw new Error("Unggah foto WebP maksimal 500 KB.");
      }
      const raw = new Uint8Array(await photo.arrayBuffer());
      const marker = String.fromCharCode(...raw.slice(0, 4));
      const fmt = String.fromCharCode(...raw.slice(8, 12));
      if (marker !== "RIFF" || fmt !== "WEBP") {
        throw new Error("Isi berkas bukan WebP yang valid.");
      }
      storedPath = `${info.classId}/${crypto.randomUUID()}.webp`;
      const upload = await db.storage
        .from("bap-documents")
        .upload(storedPath, raw, { contentType: "image/webp", upsert: false });
      if (upload.error) throw new Error(upload.error.message);
      finalPhotoPath = storedPath;
    }

    const { data: meetingId, error } = await db.rpc("start_meeting", {
      p_class_id: info.classId,
      p_type: info.type,
      p_summary: info.summary,
      p_photo_path: finalPhotoPath,
    });
    if (error) throw new Error(error.message);
    storedPath = null;

    try {
      const ids = await classRecipientIds(info.classId);
      await deliver(ids, {
        title: "Kelas dimulai",
        body: "Dosen membuka sesi perkuliahan. Presensi sekarang tersedia.",
        category: "LIVE_CLASS",
        url: `/kelas/${info.classId}`,
      });
    } catch (e) {
      console.error("Notification failed after meeting start", e);
    }
    return NextResponse.json({ ok: true, meetingId });
  } catch (e) {
    if (storedPath) {
      try {
        const { db } = await apiSession(["dosen"]);
        await db.storage.from("bap-documents").remove([storedPath]);
      } catch {
        /* cleanup best effort */
      }
    }
    return apiError(e);
  }
}
