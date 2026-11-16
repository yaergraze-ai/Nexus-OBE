import {sessionContext} from "@/lib/auth";
import {readAssignmentsBoard,readClasses,readMeetingsByClasses} from "@/lib/data";
import {SectionHead} from "@/components/UI";
import {TaskBoard} from "@/components/TaskBoard";
import type {Submission} from "@/types/coursework";
export default async function AssignmentsPage({searchParams}:{searchParams:Promise<{classId?:string}>}){
 const {classId}=await searchParams;
 const {db,profile}=await sessionContext();
 const [all,assignments,enrollRows]=await Promise.all([
  readClasses(db),
  readAssignmentsBoard(db),
  profile.role==="mahasiswa"?db.from("class_enrollments").select("class_id").eq("student_id",profile.id):Promise.resolve({data:[]})
 ]);
 const enrolled=new Set((enrollRows.data??[]).map(r=>r.class_id));
 const classes=profile.role==="dosen"?all.filter(c=>c.lecturer_identity_number===profile.identity_number):profile.role==="mahasiswa"?all.filter(c=>enrolled.has(c.id)):all;
 const [meetings,mineRows]=await Promise.all([
  readMeetingsByClasses(db,classes.map(c=>c.id)),
  profile.role==="mahasiswa"?db.from("assignment_submissions").select("*").eq("student_id",profile.id):Promise.resolve({data:[]})
 ]);
 const validInitialClass=classId&&classes.some(c=>c.id===classId)?classId:"";
 return <><SectionHead eyebrow="AKTIVITAS AKADEMIK" title="Tugas & Pengumpulan" subtitle="Kelola tugas per pertemuan, lampiran file, tautan proyek, dan penilaian PAP terhubung dosen & mahasiswa."/>
 <TaskBoard assignments={assignments} classes={classes} meetings={meetings} submissions={(mineRows.data??[]) as Submission[]} role={profile.role} currentUserId={profile.id} initialClassId={validInitialClass}/></>;
}
