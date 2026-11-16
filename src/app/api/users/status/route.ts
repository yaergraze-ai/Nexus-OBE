import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";

const schema = z.object({
  userId: z.uuid(),
  isActive: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const { db, profile } = await apiSession(["super_admin"]);
    const body = schema.parse(await boundedJson(req));

    if (body.userId === profile.id) {
      return apiError(new Error("Tidak dapat menonaktifkan akun sendiri."), 400);
    }

    const admin = adminClient();
    const { data: target, error: targetErr } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", body.userId)
      .maybeSingle();
    if (targetErr || !target) {
      return apiError(new Error("Pengguna tidak ditemukan."), 404);
    }

    const rpc = await db.rpc("set_user_active", {
      p_user_id: body.userId,
      p_active: body.isActive,
    });

    if (rpc.error) {
      if (!/could not find the function|set_user_active/i.test(rpc.error.message)) {
        throw new Error(rpc.error.message);
      }
      const { error: updErr } = await admin
        .from("profiles")
        .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
        .eq("id", body.userId);
      if (updErr) throw new Error(updErr.message);

      await admin.from("audit_logs").insert({
        actor_id: profile.id,
        action: "USER_STATUS_UPDATED",
        target_table: "profiles",
        target_id: body.userId,
        metadata: { is_active: body.isActive, role: target.role },
      });
    }

    await admin.auth.admin
      .updateUserById(body.userId, {
        ban_duration: body.isActive ? "none" : "876000h",
      })
      .catch(() => undefined);

    return NextResponse.json({ ok: true, isActive: body.isActive });
  } catch (e) {
    return apiError(e);
  }
}
