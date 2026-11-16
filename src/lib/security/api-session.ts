import "server-only";
import {createClient} from "@/lib/supabase/server";
import type {Profile,Role} from "@/types/domain";
import {sameRegisteredEmail,verifiedUserEmail} from "@/lib/security/identity";
export async function apiSession(roles?:Role[]){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)throw new Error("Silakan masuk terlebih dahulu.");
 const {data:profile,error}=await db.from("profiles").select("*").eq("id",user.id).single();
 if(error||!profile?.is_active||!sameRegisteredEmail(verifiedUserEmail(user),profile.email,user))throw new Error("Akun tidak aktif atau email tidak terverifikasi.");
 if(roles&&!roles.includes(profile.role as Role))throw new Error("Anda tidak memiliki izin untuk tindakan ini.");
 if(roles&&profile.role!=="mahasiswa"){const {data:aal,error:aalError}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aalError||(aal?.nextLevel==="aal2"&&aal?.currentLevel!=="aal2"))throw new Error("Verifikasi kode Authenticator (MFA) diperlukan. Buka Pengaturan > Keamanan Akun.");}
 return {db,user,profile:profile as Profile};
}
export async function boundedJson(req:Request,max=200_000):Promise<unknown>{
 const length=Number(req.headers.get("content-length")||0);
 if(length>max)throw new Error("Ukuran permintaan terlalu besar.");
 const text=await req.text();if(text.length>max)throw new Error("Ukuran permintaan terlalu besar.");
 try{return JSON.parse(text) as unknown;}catch{throw new Error("JSON tidak valid.");}
}
