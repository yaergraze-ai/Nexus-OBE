import {sessionContext} from "@/lib/auth";
import {readClasses} from "@/lib/data";
import {SectionHead} from "@/components/UI";
import {AnnouncementBoard} from "@/components/AnnouncementBoard";
import type {Announcement} from "@/types/coursework";
export default async function AnnouncementPage(){
 const {db,profile}=await sessionContext();const [all,announcements]=await Promise.all([
  readClasses(db),db.from("announcements").select("*,classes(id,class_code,lecturer_identity_number,courses(name_id))").order("pinned",{ascending:false}).order("created_at",{ascending:false}).limit(100)
 ]);
 if(announcements.error)throw new Error(announcements.error.message);
 const classes=profile.role==="dosen"?all.filter(c=>c.lecturer_identity_number===profile.identity_number):all;
 return <><SectionHead eyebrow="PUSAT INFORMASI" title="Pengumuman Akademik" subtitle="Informasi resmi kampus dan kelas, terhubung dengan notifikasi pengguna."/>
 <AnnouncementBoard rows={(announcements.data??[]) as unknown as Announcement[]} classes={classes} role={profile.role}/></>;
}
