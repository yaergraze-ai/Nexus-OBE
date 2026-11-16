import {sessionContext} from "@/lib/auth";
import {readClasses} from "@/lib/data";
import {SectionHead} from "@/components/UI";
import {TaskBoard} from "@/components/TaskBoard";
import type {Assignment,Submission} from "@/types/coursework";
export default async function AssignmentsPage(){
 const {db,profile}=await sessionContext();const [all,tasks]=await Promise.all([
  readClasses(db),db.from("assignments").select("*,classes!inner(id,class_code,lecturer_identity_number,courses(name_id))").order("due_at",{ascending:true}).limit(200)
 ]);
 if(tasks.error)throw new Error(tasks.error.message);
 const classes=profile.role==="dosen"?all.filter(c=>c.lecturer_identity_number===profile.identity_number):all;
 const assignments=(tasks.data??[]) as unknown as Assignment[];
 const {data:mine}=profile.role==="mahasiswa"?await db.from("assignment_submissions").select("*").eq("student_id",profile.id):{data:[]};
 return <><SectionHead eyebrow="AKTIVITAS AKADEMIK" title="Tugas & Pengumpulan" subtitle="Lampiran file privat, tautan proyek, revisi pengumpulan, tenggat WIB, dan penilaian PAP."/>
 <TaskBoard assignments={assignments} classes={classes} submissions={(mine??[]) as Submission[]} role={profile.role}/></>;
}
