import {NextResponse} from "next/server";
import {apiError} from "@/lib/api";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {assignmentInput} from "@/lib/assignments/validation";
import {deliver,classRecipientIds} from "@/lib/security/notifications";
import {adminClient} from "@/lib/supabase/admin";
export async function POST(req:Request){
 try {
  const {db}=await apiSession(["dosen"]);const entry=assignmentInput.parse(await boundedJson(req,20000));
  const {data:prior}=entry.id?await db.from("assignments").select("due_at,title").eq("id",entry.id).maybeSingle():{data:null};
  const {data:id,error}=await db.rpc("save_assignment",{p_id:entry.id,p_class_id:entry.classId,p_title:entry.title,p_description:entry.description,p_component:entry.component,p_links:entry.links,p_due_at:entry.dueAt,p_accept_late:entry.acceptLate});
  if(error)throw new Error(error.message);
  if(!entry.id||prior?.due_at!==entry.dueAt){try{
   const users=await classRecipientIds(entry.classId);
   const admin=adminClient();const {data:students}=await admin.from("profiles").select("id").in("id",users).eq("role","mahasiswa").eq("is_active",true);
   await deliver((students??[]).map(x=>x.id),{title:entry.id?"Tenggat tugas diperbarui":"Tugas baru",body:`${entry.title} • tenggat ${new Date(entry.dueAt).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} WIB`,category:"ASSIGNMENT",url:`/tugas/${id}`},false,false);
  }catch(e){console.error("optional assignment push delivery:",e);}}
  return NextResponse.json({ok:true,id});
 }catch(e){return apiError(e);}
}
