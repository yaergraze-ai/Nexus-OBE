import {NextResponse} from "next/server";
import {apiError} from "@/lib/api";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {assignmentInput,deleteAssignmentInput} from "@/lib/assignments/validation";
import {ATTACHMENT_BUCKET} from "@/lib/assignments/attachments";
import {deliver,classRecipientIds,lecturerRecipientIds} from "@/lib/security/notifications";
import {adminClient} from "@/lib/supabase/admin";
export async function POST(req:Request){
 try {
  const {db,profile}=await apiSession(["dosen","mahasiswa","admin","super_admin"]);
  const entry=assignmentInput.parse(await boundedJson(req,20000));
  const {data:prior}=entry.id?await db.from("assignments").select("due_at,title").eq("id",entry.id).maybeSingle():{data:null};
  const baseArgs={p_id:entry.id,p_class_id:entry.classId,p_title:entry.title,p_description:entry.description,p_component:entry.component,p_links:entry.links,p_due_at:entry.dueAt,p_accept_late:entry.acceptLate};
  let rpc=await db.rpc("save_assignment",{...baseArgs,p_meeting_id:entry.meetingId??null});
  if(rpc.error&&!entry.meetingId&&/Could not find the function.*save_assignment|42883|PGRST202/i.test(rpc.error.message)){
   rpc=await db.rpc("save_assignment",baseArgs);
  }
  if(rpc.error)throw new Error(rpc.error.message);
  const id=rpc.data;
  if(!entry.id||prior?.due_at!==entry.dueAt){try{
   const recipients=profile.role==="mahasiswa"?await lecturerRecipientIds(entry.classId):await classRecipientIds(entry.classId);
   const users=recipients.filter(uid=>uid!==profile.id);
   await deliver(users,{title:entry.id?"Tenggat tugas diperbarui":"Tugas baru",body:`${entry.title} • tenggat ${new Date(entry.dueAt).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} WIB`,category:"ASSIGNMENT",url:`/tugas/${id}`},false,false);
  }catch(e){console.error("optional assignment push delivery:",e);}}
  return NextResponse.json({ok:true,id});
 }catch(e){return apiError(e);}
}
export async function DELETE(req:Request){
 try {
  const {db}=await apiSession(["dosen","mahasiswa","admin","super_admin"]);
  const entry=deleteAssignmentInput.parse(await boundedJson(req,4000));
  const admin=adminClient();
  const [{data:matFiles},{data:subs}]=await Promise.all([
   admin.from("assignment_files").select("storage_path").eq("assignment_id",entry.assignmentId),
   admin.from("assignment_submissions").select("id").eq("assignment_id",entry.assignmentId)
  ]);
  const subIds=(subs??[]).map(s=>s.id);
  const {data:subFiles}=subIds.length?await admin.from("submission_files").select("storage_path").in("submission_id",subIds):{data:[]};
  const paths=[...(matFiles??[]),...(subFiles??[])].map(f=>f.storage_path).filter(Boolean);
  const {error}=await db.rpc("delete_assignment",{p_assignment_id:entry.assignmentId});
  if(error)throw new Error(error.message);
  if(paths.length){await admin.storage.from(ATTACHMENT_BUCKET).remove(paths).catch(()=>{/* best effort */});}
  return NextResponse.json({ok:true});
 }catch(e){return apiError(e);}
}
