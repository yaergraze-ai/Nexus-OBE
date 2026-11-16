import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {AcademicClass,Meeting,MeetingReference,MeetingReferenceFile,Notification,RpsCpl,RpsCpmk,RpsSub,Grade,Profile} from "@/types/domain";
import type {Assignment} from "@/types/coursework";
import {MEETING_REF_BUCKET} from "@/lib/assignments/attachments";
export async function readClasses(db:SupabaseClient){
 const {data,error}=await db.from("classes").select("*, courses(*), lecturer_directory(*)").order("schedule_day");
 if(error)throw new Error(error.message);return (data??[]) as AcademicClass[];
}
export async function readClass(db:SupabaseClient,id:string){
 const {data,error}=await db.from("classes").select("*, courses(*), lecturer_directory(*)").eq("id",id).maybeSingle();
 if(error)throw new Error(error.message);return data as AcademicClass|null;
}
export async function readMeetings(db:SupabaseClient,classId:string){
 const {data,error}=await db.from("meetings").select("*").eq("class_id",classId).order("meeting_number",{ascending:false});
 if(error)throw new Error(error.message);return (data??[]) as Meeting[];
}
export async function readMeetingsByClasses(db:SupabaseClient,classIds:string[]){
 if(!classIds.length)return [] as Meeting[];
 const {data,error}=await db.from("meetings").select("*").in("class_id",classIds).order("meeting_number",{ascending:true});
 if(error)throw new Error(error.message);return (data??[]) as Meeting[];
}
export async function readAssignmentsBoard(db:SupabaseClient,classId?:string){
 const withMeeting="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id)),meetings(id,meeting_number,meeting_date,type),profiles:author_id(full_name,identity_number,role)";
 const base="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id)),profiles:author_id(full_name,identity_number,role)";
 const q1=db.from("assignments").select(withMeeting).order("created_at",{ascending:false}).limit(200);
 const res1=await (classId?q1.eq("class_id",classId):q1);
 if(!res1.error)return (res1.data??[]) as unknown as Assignment[];
 if(res1.error.code==="PGRST200"||res1.error.code==="42703"||/meetings|meeting_id|profiles/i.test(res1.error.message)){
  const simpleBase="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id))";
  const q2=db.from("assignments").select(res1.error.message.includes("profiles")?simpleBase:base).order("due_at",{ascending:true}).limit(200);
  const res2=await (classId?q2.eq("class_id",classId):q2);
  if(res2.error)throw new Error(res2.error.message);
  return (res2.data??[]) as unknown as Assignment[];
 }
 throw new Error(res1.error.message);
}
export async function readAssignmentById(db:SupabaseClient,assignmentId:string){
 const withMeeting="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id)),meetings(id,meeting_number,meeting_date,type),profiles:author_id(full_name,identity_number,role)";
 const base="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id))";
 const res1=await db.from("assignments").select(withMeeting).eq("id",assignmentId).maybeSingle();
 if(!res1.error)return (res1.data??null) as unknown as Assignment|null;
 if(res1.error.code==="PGRST200"||res1.error.code==="42703"||/meetings|meeting_id|profiles/i.test(res1.error.message)){
  const res2=await db.from("assignments").select(base).eq("id",assignmentId).maybeSingle();
  if(res2.error)throw new Error(res2.error.message);
  return (res2.data??null) as unknown as Assignment|null;
 }
 throw new Error(res1.error.message);
}
export async function readNotifications(db:SupabaseClient,userId:string){
 const {data,error}=await db.from("notifications").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(60);
 if(error)throw new Error(error.message);return (data??[]) as Notification[];
}
export async function readRps(db:SupabaseClient,courseId:string){
 const [a,b,c]=await Promise.all([
  db.from("rps_cpl").select("*").eq("course_id",courseId).order("code"),
  db.from("rps_cpmk").select("*").eq("course_id",courseId).order("code"),
  db.from("rps_sub_cpmk").select("*").eq("course_id",courseId).order("code")
 ]);
 if(a.error||b.error||c.error)throw new Error(a.error?.message||b.error?.message||c.error?.message);
 return {cpls:(a.data??[]) as RpsCpl[],cpmks:(b.data??[]) as RpsCpmk[],subs:(c.data??[]) as RpsSub[]};
}
export async function readGrades(db:SupabaseClient,classId:string){
 const {data,error}=await db.from("grades").select("*").eq("class_id",classId);if(error)throw new Error(error.message);return (data??[]) as Grade[];
}
export async function readStudents(db:SupabaseClient,classId:string){
 const {data,error}=await db.from("class_enrollments").select("student_id, profiles:student_id(id,full_name,identity_number,email,role,is_active)").eq("class_id",classId);
 if(error)throw new Error(error.message);return (data??[]).map(r=>r.profiles as unknown as Profile).filter(Boolean);
}
export async function readMeetingReferences(db:SupabaseClient,classId:string):Promise<Record<string,MeetingReference[]>>{
 const [{data:refs,error:refErr},{data:files,error:fileErr}]=await Promise.all([
  db.from("meeting_references").select("*").eq("class_id",classId).order("created_at",{ascending:true}),
  db.from("meeting_reference_files").select("*").eq("class_id",classId).order("created_at",{ascending:true})
 ]);
 if(refErr||fileErr){
  const code=refErr?.code||fileErr?.code;
  if(code==="42P01"||code==="PGRST205")return {};
  throw new Error(refErr?.message||fileErr?.message);
 }
 const rawFiles=(files??[]) as MeetingReferenceFile[];
 const signedUrls=await Promise.all(rawFiles.map(f=>db.storage.from(MEETING_REF_BUCKET).createSignedUrl(f.storage_path,3600)));
 const filesByRef:Record<string,MeetingReferenceFile[]>={};
 rawFiles.forEach((f,i)=>{
  const list=filesByRef[f.reference_id]??[];
  list.push({...f,signedUrl:signedUrls[i]?.data?.signedUrl});
  filesByRef[f.reference_id]=list;
 });
 const byMeeting:Record<string,MeetingReference[]>={};
 for(const r of (refs??[]) as Omit<MeetingReference,"files">[]){
  const list=byMeeting[r.meeting_id]??[];
  list.push({...r,files:filesByRef[r.id]??[]});
  byMeeting[r.meeting_id]=list;
 }
 return byMeeting;
}
