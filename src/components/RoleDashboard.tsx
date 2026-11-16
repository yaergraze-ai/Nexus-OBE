import {sessionContext} from "@/lib/auth";
import {readClasses,readNotifications} from "@/lib/data";
import {Dashboard} from "@/components/Dashboard";
import type {DashboardInsight} from "@/components/Dashboard";
import type {Role} from "@/types/domain";
import type {Announcement} from "@/types/coursework";
import {redirect} from "next/navigation";
export async function RoleDashboard({role}:{role:Role}){
 const {db,profile}=await sessionContext();if(profile.role!==role)redirect("/dashboard");
 const [all,notifications,announcementRows,meetingCount,recentTaskRows]=await Promise.all([
  readClasses(db),readNotifications(db,profile.id),
  db.from("announcements").select("id,title,body,created_at").order("created_at",{ascending:false}).limit(3),
  db.from("meetings").select("id",{count:"exact",head:true}),
  db.from("assignments").select("id,title,due_at,class_id").order("due_at",{ascending:true}).limit(5)
 ]);
 let classes=role==="dosen"?all.filter(c=>c.lecturer_identity_number===profile.identity_number):all;
 let ips:number|null=null;const insights:DashboardInsight[]=[];
 if(role==="mahasiswa"){
  const [{data:enrollments},{data:gradeRows},{data:tasks},{data:submissions}]=await Promise.all([
   db.from("class_enrollments").select("class_id").eq("student_id",profile.id),
   db.from("vw_student_final_grades").select("class_id,quality_point").eq("student_id",profile.id),
   db.from("assignments").select("id,due_at,published"),
   db.from("assignment_submissions").select("assignment_id,status").eq("student_id",profile.id)
  ]);
  const enrolledIds=new Set((enrollments??[]).map(e=>e.class_id));classes=all.filter(c=>enrolledIds.has(c.id));
  const summed=(gradeRows??[]).reduce((acc,g)=>{const found=all.find(c=>c.id===g.class_id);return found?{weighted:acc.weighted+Number(g.quality_point)*found.courses.sks_total,sks:acc.sks+found.courses.sks_total}:acc;},{weighted:0,sks:0});
  ips=summed.sks>0?Math.round(summed.weighted/summed.sks*100)/100:null;
  const done=new Set((submissions??[]).filter(x=>x.status==="SUBMITTED").map(x=>x.assignment_id));
  const open=(tasks??[]).filter(t=>t.published&&!done.has(t.id));
  insights.push({label:"Tugas Perlu Dikumpulkan",value:open.length,description:"Buka tugas & unggah lampiran",href:"/tugas",icon:"clipboard2-check"});
  insights.push({label:"Tugas Sudah Terkumpul",value:done.size,description:"Lihat hasil dan revisi",href:"/tugas",icon:"check2-circle"});
  insights.push({label:"Belum Dibaca",value:notifications.filter(n=>!n.is_read).length,description:"Notifikasi perkuliahan",href:"/notifikasi",icon:"bell"});
 }else if(role==="dosen"){
  const [taskRows,submissionRows]=await Promise.all([
   db.from("assignments").select("id"),
   db.from("assignment_submissions").select("id,status,score")
  ]);
  insights.push({label:"Tugas Diterbitkan",value:taskRows.data?.length??0,description:"Kelola instruksi dan tenggat",href:"/tugas",icon:"journal-plus"});
  insights.push({label:"Pengumpulan Belum Dinilai",value:(submissionRows.data??[]).filter(s=>s.status==="SUBMITTED"&&s.score==null).length,description:"Periksa kiriman mahasiswa",href:"/tugas",icon:"clipboard-data"});
  insights.push({label:"RPS Menunggu Validasi",value:classes.filter(c=>!c.rps_validated_kaprodi||!c.rps_validated_dekan).length,description:"Lengkapi dan ajukan RPS",href:"/kelas",icon:"patch-exclamation"});
 }else if(role==="admin"){
  const [{data:studentRows},{data:tasks}]=await Promise.all([
   db.from("profiles").select("id").eq("role","mahasiswa").eq("is_active",true),
   db.from("assignments").select("id")
  ]);
  insights.push({label:"RPS Perlu Ditindaklanjuti",value:classes.filter(c=>!c.rps_validated_kaprodi||!c.rps_validated_dekan).length,description:"Persetujuan Kaprodi / Dekan",href:"/rps-review",icon:"patch-exclamation"});
  insights.push({label:"Mahasiswa Aktif",value:studentRows?.length??0,description:"Kelola peserta KRS",href:"/krs",icon:"people"});
  insights.push({label:"Tugas Dipublikasikan",value:tasks?.length??0,description:"Pantau pengumpulan kelas",href:"/tugas",icon:"clipboard2-check"});
  insights.push({label:"Pengelolaan Jadwal",value:classes.length,description:"Deteksi bentrok ruangan dan ujian",href:"/jadwal",icon:"calendar-check"});
 }else{
  const [{data:profiles},{data:auditRows},{data:tasks}]=await Promise.all([
   db.from("profiles").select("id,role,is_active"),
   db.from("audit_logs").select("id").order("created_at",{ascending:false}).limit(200),
   db.from("assignments").select("id")
  ]);
  insights.push({label:"Akun Aktif",value:(profiles??[]).filter(p=>p.is_active).length,description:"Kelola peran & status akun",href:"/pengguna",icon:"people-fill"});
  insights.push({label:"Log Keamanan",value:auditRows?.length??0,description:"200 entri terkini maksimal",href:"/audit",icon:"shield-lock"});
  insights.push({label:"Validasi RPS & PBM",value:classes.filter(c=>!c.rps_validated_kaprodi||!c.rps_validated_dekan).length,description:"Otorisasi RPS & kontrol PBM",href:"/rps-review",icon:"patch-check"});
  insights.push({label:"Kelas & Peserta KRS",value:classes.length,description:"Kelola jadwal & KRS mahasiswa",href:"/krs",icon:"calendar3"});
  insights.push({label:"Total Tugas",value:tasks?.length??0,description:"Kontrol operasional tugas",href:"/tugas",icon:"clipboard2-data"});
 }
 const [{data:liveRows},{data:aal}]=await Promise.all([
  db.from("meetings").select("*").eq("status","LIVE").gt("ends_at",new Date().toISOString()).limit(20),
  db.auth.mfa.getAuthenticatorAssuranceLevel()
 ]);
 return <Dashboard profile={profile} classes={classes} notifications={notifications} ips={ips} liveMeetings={liveRows??[]}
 insights={insights} announcements={(announcementRows.data??[]) as unknown as Announcement[]} recentTasks={recentTaskRows.data??[]} actualSessions={meetingCount.count??0}
 mustChangePassword={Boolean(profile.must_change_password)} needsMfa={profile.role!=="mahasiswa"&&aal?.nextLevel==="aal2"&&aal?.currentLevel!=="aal2"}/>;
}
