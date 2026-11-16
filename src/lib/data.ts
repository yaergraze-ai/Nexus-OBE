import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {AcademicClass,Meeting,MeetingReference,MeetingReferenceFile,Notification,RpsCpl,RpsCpmk,RpsSub,Grade,Profile,Role} from "@/types/domain";
import type {Assignment} from "@/types/coursework";
import {MEETING_REF_BUCKET} from "@/lib/assignments/attachments";
import {adminClient} from "@/lib/supabase/admin";
import {calculateFinal} from "@/lib/utils/grade-calculator";
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
async function filterStudentVisibleAssignments(rows:Assignment[],viewer?:{id:string;role:Role}){
 if(!viewer||viewer.role!=="mahasiswa"||!rows.length)return rows;
 const foreignAuthorIds=[...new Set(rows.map(r=>r.author_id).filter(id=>id!==viewer.id))];
 if(!foreignAuthorIds.length)return rows;
 const {data:authors}=await adminClient().from("profiles").select("id,role").in("id",foreignAuthorIds);
 const studentAuthors=new Set((authors??[]).filter(a=>a.role==="mahasiswa").map(a=>a.id));
 return rows.filter(r=>r.author_id===viewer.id||!studentAuthors.has(r.author_id));
}
export async function readAssignmentsBoard(db:SupabaseClient,classId?:string,viewer?:{id:string;role:Role}){
 const withMeeting="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id)),meetings(id,meeting_number,meeting_date,type)";
 const base="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id))";
 const q1=db.from("assignments").select(withMeeting).order("created_at",{ascending:false}).limit(200);
 const res1=await (classId?q1.eq("class_id",classId):q1);
 if(!res1.error)return filterStudentVisibleAssignments((res1.data??[]) as unknown as Assignment[],viewer);
 if(res1.error.code==="PGRST200"||res1.error.code==="42703"||/meetings|meeting_id/i.test(res1.error.message)){
  const q2=db.from("assignments").select(base).order("due_at",{ascending:true}).limit(200);
  const res2=await (classId?q2.eq("class_id",classId):q2);
  if(res2.error)throw new Error(res2.error.message);
  return filterStudentVisibleAssignments((res2.data??[]) as unknown as Assignment[],viewer);
 }
 throw new Error(res1.error.message);
}
export async function readAssignmentById(db:SupabaseClient,assignmentId:string,viewer?:{id:string;role:Role}){
 const withMeeting="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id)),meetings(id,meeting_number,meeting_date,type)";
 const base="*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id))";
 const res1=await db.from("assignments").select(withMeeting).eq("id",assignmentId).maybeSingle();
 let task:Assignment|null=null;
 if(!res1.error){task=(res1.data??null) as unknown as Assignment|null;}
 else if(res1.error.code==="PGRST200"||res1.error.code==="42703"||/meetings|meeting_id/i.test(res1.error.message)){
  const res2=await db.from("assignments").select(base).eq("id",assignmentId).maybeSingle();
  if(res2.error)throw new Error(res2.error.message);
  task=(res2.data??null) as unknown as Assignment|null;
 }else{
  throw new Error(res1.error.message);
 }
 if(!task)return null;
 const visible=await filterStudentVisibleAssignments([task],viewer);
 return visible[0]??null;
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
async function canInspectRoster(viewer: {id:string;role:Role;identity_number?:string} | undefined, classId: string){
 if(!viewer)return false;
 if(viewer.role==="admin"||viewer.role==="super_admin")return true;
 if(viewer.role!=="dosen"||!viewer.identity_number)return false;
 const {data}=await adminClient().from("classes").select("lecturer_identity_number").eq("id",classId).maybeSingle();
 return data?.lecturer_identity_number===viewer.identity_number;
}

export async function readStudents(db:SupabaseClient,classId:string,viewer?:{id:string;role:Role;identity_number?:string}){
 const {data,error}=await db.from("class_enrollments").select("student_id, profiles:student_id(id,full_name,identity_number,email,role,is_active)").eq("class_id",classId);
 if(error)throw new Error(error.message);
 let list=(data??[]).map(r=>r.profiles as unknown as Profile).filter(p=>p&&p.is_active!==false);
 if(list.length===0&&await canInspectRoster(viewer,classId)){
  const fallback=await adminClient().from("class_enrollments").select("student_id, profiles:student_id(id,full_name,identity_number,email,role,is_active)").eq("class_id",classId);
  if(!fallback.error){
   list=(fallback.data??[]).map(r=>r.profiles as unknown as Profile).filter(p=>p&&p.is_active!==false&&p.role==="mahasiswa");
  }
 }
 return list.sort((a,b)=>a.full_name.localeCompare(b.full_name));
}

function authorizedRosterClasses(classes:AcademicClass[],viewer:{id:string;role:Role;identity_number?:string}){
 if(viewer.role==="admin"||viewer.role==="super_admin")return classes;
 if(viewer.role==="dosen"&&viewer.identity_number){
  return classes.filter(c=>c.lecturer_identity_number===viewer.identity_number);
 }
 return [] as AcademicClass[];
}

export async function readClassStudentCounts(classes:AcademicClass[],viewer:{id:string;role:Role;identity_number?:string}){
 const scoped=authorizedRosterClasses(classes,viewer);
 const counts:Record<string,number>={};
 for(const c of scoped)counts[c.id]=0;
 if(!scoped.length)return {counts,uniqueStudentCount:0,totalEnrollments:0};

 const classIds=scoped.map(c=>c.id);
 const {data:enrollRows,error}=await adminClient().from("class_enrollments").select("class_id,student_id,profiles:student_id!inner(id,role,is_active)").in("class_id",classIds).eq("profiles.role","mahasiswa").eq("profiles.is_active",true);
 if(error)throw new Error(error.message);

 const uniqueIds=new Set<string>();
 for(const row of enrollRows??[]){
  counts[row.class_id]=(counts[row.class_id]??0)+1;
  uniqueIds.add(row.student_id);
 }
 return {counts,uniqueStudentCount:uniqueIds.size,totalEnrollments:(enrollRows??[]).length};
}

export interface StudentClassStanding{
 classId:string;
 courseCode:string;
 courseName:string;
 classCode:string;
 lecturerName:string;
 lecturerIdentity:string;
 scheduleDay:string;
 startTime:string;
 endTime:string;
 sks:number;
 attendedCount:number;
 totalMeetings:number;
 attendancePct:number;
 gradeNumeric:number|null;
 gradeLetter:string|null;
 gradeQuality:number|null;
 passingTarget:number;
}

export interface TeachingStudentSummary{
 studentId:string;
 fullName:string;
 identityNumber:string;
 email:string;
 earliestEnrolledAt:string;
 classes:StudentClassStanding[];
 avgAttendancePct:number;
 gradedCount:number;
 avgNumeric:number|null;
 needsAttention:boolean;
}

export async function readTeachingRosterData(classes:AcademicClass[],viewer:{id:string;role:Role;identity_number?:string}){
 const scoped=authorizedRosterClasses(classes,viewer);
 const classCounts:Record<string,number>={};
 for(const c of scoped)classCounts[c.id]=0;
 if(!scoped.length)return {students:[] as TeachingStudentSummary[],classCounts,totalEnrollments:0,avgAttendancePct:0,gradedEntries:0};

 const admin=adminClient();
 const classIds=scoped.map(c=>c.id);
 const classMap=new Map(scoped.map(c=>[c.id,c]));

 const [{data:enrollRows,error:enrollErr},{data:meetingRows,error:mtgErr},{data:gradeRows,error:gradeErr}]=await Promise.all([
  admin.from("class_enrollments").select("class_id,student_id,enrolled_at,profiles:student_id!inner(id,full_name,identity_number,email,role,is_active)").in("class_id",classIds).eq("profiles.role","mahasiswa").eq("profiles.is_active",true),
  admin.from("meetings").select("id,class_id").in("class_id",classIds),
  admin.from("grades").select("class_id,student_id,score_attendance,score_uts,score_uas,score_daily_task,score_group_task,score_major_project").in("class_id",classIds)
 ]);

 if(enrollErr)throw new Error(enrollErr.message);
 if(mtgErr)throw new Error(mtgErr.message);
 if(gradeErr)throw new Error(gradeErr.message);

 const meetingsByClass=new Map<string,string[]>();
 const meetingToClass=new Map<string,string>();
 for(const m of meetingRows??[]){
  meetingToClass.set(m.id,m.class_id);
  const arr=meetingsByClass.get(m.class_id)??[];
  arr.push(m.id);
  meetingsByClass.set(m.class_id,arr);
 }

 const allMeetingIds=[...meetingToClass.keys()];
 const hadirCountByKey=new Map<string,number>();
 if(allMeetingIds.length){
  const {data:attRows,error:attErr}=await admin.from("attendances").select("meeting_id,student_id,status").in("meeting_id",allMeetingIds).eq("status","HADIR");
  if(attErr)throw new Error(attErr.message);
  for(const a of attRows??[]){
   const cid=meetingToClass.get(a.meeting_id);
   if(!cid)continue;
   const key=`${cid}:${a.student_id}`;
   hadirCountByKey.set(key,(hadirCountByKey.get(key)??0)+1);
  }
 }

 const gradeByKey=new Map<string,{numeric:number;letter:string;quality:number}>();
 for(const g of gradeRows??[]){
  try{
   const fin=calculateFinal({
    attendance:Number(g.score_attendance),
    uts:Number(g.score_uts),
    uas:Number(g.score_uas),
    daily_task:Number(g.score_daily_task),
    group_task:Number(g.score_group_task),
    major_project:Number(g.score_major_project)
   });
   gradeByKey.set(`${g.class_id}:${g.student_id}`,fin);
  }catch{
   // Skip malformed grade entries gracefully.
  }
 }

 const byStudent=new Map<string,TeachingStudentSummary>();
 let totalEnrollments=0;
 let gradedEntries=0;
 let attPctSum=0;

 for(const row of enrollRows??[]){
  const prof=row.profiles as unknown as Profile|null;
  const klass=classMap.get(row.class_id);
  if(!prof||!klass)continue;

  totalEnrollments+=1;
  classCounts[klass.id]=(classCounts[klass.id]??0)+1;

  const totalMeetings=(meetingsByClass.get(klass.id)??[]).length;
  const attendedCount=hadirCountByKey.get(`${klass.id}:${prof.id}`)??0;
  const attendancePct=totalMeetings>0?Math.round((attendedCount/totalMeetings)*100):100;
  if(totalMeetings>0)attPctSum+=attendancePct;

  const grade=gradeByKey.get(`${klass.id}:${prof.id}`)??null;
  if(grade)gradedEntries+=1;

  const standing:StudentClassStanding={
   classId:klass.id,
   courseCode:klass.courses.course_code,
   courseName:klass.courses.name_id,
   classCode:klass.class_code,
   lecturerName:klass.lecturer_directory.full_name,
   lecturerIdentity:klass.lecturer_identity_number,
   scheduleDay:klass.schedule_day,
   startTime:klass.start_time,
   endTime:klass.end_time,
   sks:Number(klass.courses.sks_total),
   attendedCount,
   totalMeetings,
   attendancePct,
   gradeNumeric:grade?.numeric??null,
   gradeLetter:grade?.letter??null,
   gradeQuality:grade?.quality??null,
   passingTarget:klass.courses.passing_grade_target
  };

  const existing=byStudent.get(prof.id);
  if(existing){
   existing.classes.push(standing);
   if(row.enrolled_at&&row.enrolled_at<existing.earliestEnrolledAt){
    existing.earliestEnrolledAt=row.enrolled_at;
   }
  }else{
   byStudent.set(prof.id,{
    studentId:prof.id,
    fullName:prof.full_name,
    identityNumber:prof.identity_number,
    email:prof.email,
    earliestEnrolledAt:row.enrolled_at??"",
    classes:[standing],
    avgAttendancePct:0,
    gradedCount:0,
    avgNumeric:null,
    needsAttention:false
   });
  }
 }

 const students=[...byStudent.values()].map(st=>{
  const withMtgs=st.classes.filter(c=>c.totalMeetings>0);
  const avgAttendancePct=withMtgs.length
   ?Math.round(withMtgs.reduce((s,c)=>s+c.attendancePct,0)/withMtgs.length)
   :100;
  const graded=st.classes.filter(c=>c.gradeNumeric!==null);
  const avgNumeric=graded.length
   ?Math.round((graded.reduce((s,c)=>s+(c.gradeNumeric??0),0)/graded.length)*100)/100
   :null;
  const lowAttendance=withMtgs.some(c=>c.attendancePct<75);
  const belowTarget=st.classes.some(c=>c.gradeQuality!==null&&c.gradeQuality<c.passingTarget);
  return {
   ...st,
   classes:st.classes.sort((a,b)=>a.courseName.localeCompare(b.courseName)),
   avgAttendancePct,
   gradedCount:graded.length,
   avgNumeric,
   needsAttention:lowAttendance||belowTarget
  };
 }).sort((a,b)=>a.fullName.localeCompare(b.fullName));

 const entriesWithMtgs=students.reduce((s,st)=>s+st.classes.filter(c=>c.totalMeetings>0).length,0);
 return {
  students,
  classCounts,
  totalEnrollments,
  avgAttendancePct:entriesWithMtgs>0?Math.round(attPctSum/entriesWithMtgs):100,
  gradedEntries
 };
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
