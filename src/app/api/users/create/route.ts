import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, boundedJson } from "@/lib/security/api-session";
import { safeReturnOrigin } from "@/lib/security/identity";
import { adminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email().max(150),
  fullName: z.string().trim().min(3).max(150),
  identityNumber: z.string().trim().min(4).max(30),
  role: z.enum(["mahasiswa", "dosen", "admin", "super_admin"]),
  initialPasswordMode: z.enum(["invite", "identity"]).default("invite"),
});

export async function POST(req: Request) {
  try {
    await apiSession(["super_admin"]);
    const v = schema.parse(await boundedJson(req));
    const db = adminClient();
    const email = v.email.trim().toLowerCase();
    const identityNumber = v.identityNumber.trim();

    if (v.initialPasswordMode === "identity" && identityNumber.length < 8) {
      throw new Error(
        "NIM/NIDN minimal 8 karakter untuk dipakai sebagai sandi awal. Gunakan mode undangan email."
      );
    }

    const [sameEmail, sameNumber] = await Promise.all([
      db.from("profiles").select("id").eq("email", email).limit(1),
      db.from("profiles").select("id").eq("identity_number", identityNumber).limit(1),
    ]);
    if (sameEmail.error || sameNumber.error) throw new Error("Pemeriksaan akun gagal.");
    if (sameEmail.data?.length || sameNumber.data?.length) {
      throw new Error("Email atau nomor induk sudah terdaftar.");
    }

    const allow = await db
      .from("account_allowlist")
      .upsert({ email }, { onConflict: "email" });
    if (allow.error) {
      throw new Error(
        "Gagal mengizinkan email institusi. Pastikan migrasi 004 sudah dijalankan."
      );
    }

    let userId: string;
    if (v.initialPasswordMode === "identity") {
      // Initial password equals NIM/NIDN; user must replace it upon first login.
      const created = await db.auth.admin.createUser({
        email,
        password: identityNumber,
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        await db.from("account_allowlist").delete().eq("email", email);
        throw new Error(created.error?.message || "Gagal membuat akun.");
      }
      userId = created.data.user.id;
      await Promise.resolve(db.rpc("sync_verified_email_identity", { p_user_id: userId })).catch(() => undefined);
    } else {
      const site =
        process.env.NEXT_PUBLIC_SITE_URL &&
        /^https?:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL)
          ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
          : safeReturnOrigin(req);
      const invited = await db.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${site}/auth/confirm`,
      });
      if (invited.error || !invited.data.user) {
        await db.from("account_allowlist").delete().eq("email", email);
        throw new Error(invited.error?.message || "Gagal mengirim undangan.");
      }
      userId = invited.data.user.id;
    }

    const profileRow: Record<string, unknown> = {
      id: userId,
      email,
      full_name: v.fullName,
      identity_number: identityNumber,
      role: v.role,
    };
    if (v.initialPasswordMode === "identity") {
      profileRow.must_change_password = true;
    }

    const { error } = await db.from("profiles").insert(profileRow);
    if (error) {
      await db.auth.admin.deleteUser(userId);
      await db.from("account_allowlist").delete().eq("email", email);
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      invited: v.initialPasswordMode === "invite",
      mustChangePassword: v.initialPasswordMode === "identity",
    });
  } catch (e) {
    return apiError(e);
  }
}
