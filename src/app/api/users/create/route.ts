import {NextResponse} from "next/server";
import {z} from "zod";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {safeReturnOrigin} from "@/lib/security/identity";
import {adminClient} from "@/lib/supabase/admin";
import {apiError} from "@/lib/api";
export const runtime="nodejs";
const schema=z.object({email:z.email().max(150),fullName:z.string().trim().min(3).max(150),identityNumber:z.string().trim().min(4).max(30),role:z.enum(["mahasiswa","dosen","admin","super_admin"])});
export async function POST(req:Request){try{
 await apiSession(["super_admin"]);const v=schema.parse(await boundedJson(req));const db=adminClient();
 const email=v.email.trim().toLowerCase();
 const [sameEmail,sameNumber]=await Promise.all([
  db.from("profiles").select("id").eq("email",email).limit(1),
  db.from("profiles").select("id").eq("identity_number",v.identityNumber).limit(1)
 ]);
 if(sameEmail.error||sameNumber.error)throw new Error("Pemeriksaan akun gagal.");
 if(sameEmail.data?.length||sameNumber.data?.length)throw new Error("Email atau nomor induk sudah terdaftar.");
 const site=(process.env.NEXT_PUBLIC_SITE_URL&&/^https?:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL))
  ?process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/,"")
  :safeReturnOrigin(req);
 // An invite never exposes a password in an API response or sets a shared password.
 const allow=await db.from("account_allowlist").insert({email});
 if(allow.error)throw new Error("Gagal mengizinkan email institusi. Pastikan migrasi 004 sudah dijalankan.");
 const invited=await db.auth.admin.inviteUserByEmail(email,{redirectTo:`${site}/auth/confirm`});
 if(invited.error){await db.from("account_allowlist").delete().eq("email",email);throw new Error(invited.error.message);}
 const id=invited.data.user.id;
 const {error}=await db.from("profiles").insert({id,email,full_name:v.fullName,identity_number:v.identityNumber,role:v.role});
 if(error){await db.auth.admin.deleteUser(id);await db.from("account_allowlist").delete().eq("email",email);throw new Error(error.message);}
 return NextResponse.json({ok:true,invited:true});
}catch(e){return apiError(e);}}
