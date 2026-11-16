import {NextResponse} from "next/server";
import {apiSession} from "@/lib/security/api-session";
import {apiError} from "@/lib/api";
export const runtime="nodejs";
export async function POST(req:Request){try{
 const declared=Number(req.headers.get("content-length")||0);if(declared>800_000)throw new Error("Foto terlalu besar.");
 const {db,user}=await apiSession();const form=await req.formData();const photo=form.get("photo");
 if(!(photo instanceof File)||photo.size<16||photo.size>500_000||photo.type!=="image/webp")throw new Error("Foto harus WebP maksimal 500 KB.");
 const bytes=new Uint8Array(await photo.arrayBuffer());
 if(String.fromCharCode(...bytes.slice(0,4))!=="RIFF"||String.fromCharCode(...bytes.slice(8,12))!=="WEBP")throw new Error("Format foto tidak valid.");
 const path=`${user.id}/avatar.webp`;
 const save=await db.storage.from("profile-avatars").upload(path,bytes,{contentType:"image/webp",upsert:true,cacheControl:"60"});
 if(save.error)throw save.error;
 const changed=await db.from("profiles").update({avatar_url:path,updated_at:new Date().toISOString()}).eq("id",user.id);
 if(changed.error)throw changed.error;
 return NextResponse.json({ok:true});
}catch(e){return apiError(e);}}
