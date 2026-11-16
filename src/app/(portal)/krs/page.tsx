import {requireRole} from "@/lib/auth";import {readClasses} from "@/lib/data";
import {SectionHead} from "@/components/UI";import {KrsManager} from "@/components/KrsManager";
import type {Profile} from "@/types/domain";
export default async function KrsPage(){const {db}=await requireRole("admin","super_admin");const [classes,{data,error}]=await Promise.all([readClasses(db),db.from("profiles").select("*").eq("role","mahasiswa").eq("is_active",true).order("full_name")]);if(error)throw new Error(error.message);return <><SectionHead eyebrow="MANAJEMEN AKADEMIK" title="Peserta KRS" subtitle="Daftarkan akun mahasiswa pada kelas yang diikuti agar presensi dan nilai dapat diproses."/><KrsManager classes={classes} students={(data??[]) as Profile[]}/></>;}
