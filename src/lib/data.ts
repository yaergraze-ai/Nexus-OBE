import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {AcademicClass,Meeting,Notification,RpsCpl,RpsCpmk,RpsSub,Grade,Profile} from "@/types/domain";
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
