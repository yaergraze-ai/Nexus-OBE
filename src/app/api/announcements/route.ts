import {NextResponse} from "next/server";
import {apiError} from "@/lib/api";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {announcementInput} from "@/lib/assignments/validation";
import {adminClient} from "@/lib/supabase/admin";
import {deliver,classRecipientIds} from "@/lib/security/notifications";

export async function POST(req:Request){
 try {
  const {db,profile}=await apiSession(["dosen","admin","super_admin"]);
  const entry=announcementInput.parse(await boundedJson(req,16000));
  if(profile.role==="dosen"&&(!entry.classId||!["all","mahasiswa"].includes(entry.audience)))throw new Error("Dosen hanya dapat menerbitkan informasi kelas.");
  const {data:id,error}=await db.rpc("publish_announcement",{p_class_id:entry.classId,p_audience:entry.audience,p_title:entry.title,p_body:entry.body,p_pinned:entry.pinned,p_expires_at:entry.expiresAt});
  if(error)throw new Error(error.message);
  // RLS + SQL trigger persists in-app notifications atomically with announcement.
  // Push/email is a best-effort additional transport and must not duplicate rows.
  try{
   const admin=adminClient();
   const {data:profiles}=await admin.from("profiles").select("id,role,identity_number").eq("is_active",true);
   let ids:string[]=[];
   if(entry.classId){
    const members=new Set(await classRecipientIds(entry.classId));
    ids=(profiles??[]).filter(p=>(members.has(p.id)||["admin","super_admin"].includes(p.role))&&(entry.audience==="all"||p.role===entry.audience)).map(p=>p.id);
   }else ids=(profiles??[]).filter(p=>entry.audience==="all"||p.role===entry.audience).map(p=>p.id);
   await deliver(ids,{title:entry.title,body:entry.body.slice(0,500),category:"ANNOUNCEMENT",url:"/pengumuman"},false,false);
  }catch(e){console.error("optional announcement push delivery:",e);}
  return NextResponse.json({ok:true,id});
 }catch(e){return apiError(e);}
}
