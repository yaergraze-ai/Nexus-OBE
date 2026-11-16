import {sessionContext} from "@/lib/auth";import {readClasses} from "@/lib/data";import {SectionHead} from "@/components/UI";import {ScheduleManager} from "@/components/ScheduleManager";
export default async function SchedulePage(){const {db,profile}=await sessionContext();const all=await readClasses(db);let classes=profile.role==="dosen"?all.filter(c=>c.lecturer_identity_number===profile.identity_number):all;
 if(profile.role==="mahasiswa"){const {data:enrollments}=await db.from("class_enrollments").select("class_id").eq("student_id",profile.id);const allowed=new Set((enrollments??[]).map(x=>x.class_id));classes=all.filter(c=>allowed.has(c.id));}let sharedEnrollments:string[]=[];
 if(profile.role==="admin"||profile.role==="super_admin"){
  const {data:enrollmentRows,error:enrollmentError}=await db.from("class_enrollments").select("class_id,student_id");
  if(enrollmentError)throw new Error(enrollmentError.message);
  const groups=new Map<string,string[]>();
  for(const row of enrollmentRows??[])groups.set(row.student_id,[...(groups.get(row.student_id)??[]),row.class_id]);
  const pairSet=new Set<string>();
  for(const cohort of groups.values())for(let i=0;i<cohort.length;i++)for(let j=i+1;j<cohort.length;j++)pairSet.add([cohort[i],cohort[j]].sort().join(":"));
  sharedEnrollments=[...pairSet];
 }
 return <><SectionHead eyebrow="KALENDER AKADEMIK" title="Jadwal Perkuliahan" subtitle="Jadwal mingguan, ruangan, dan informasi UTS/UAS · Zona WIB"/><ScheduleManager classes={classes} sharedEnrollments={sharedEnrollments} admin={profile.role==="admin"||profile.role==="super_admin"}/></>;}
