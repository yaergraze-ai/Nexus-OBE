"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import type {AcademicClass,Role} from "@/types/domain";
import type {Announcement} from "@/types/coursework";
import {dateTimeWib,wibToIso} from "@/lib/utils/wib";
import {postJson} from "@/lib/utils/request";
import {Empty,Tag} from "@/components/UI";
export function AnnouncementBoard({rows,classes,role}:{rows:Announcement[];classes:AcademicClass[];role:Role}){
 const router=useRouter();const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [classId,setClassId]=useState("");const [audience,setAudience]=useState("all");const [title,setTitle]=useState("");const [body,setBody]=useState("");const [pinned,setPinned]=useState(false);const [expiry,setExpiry]=useState("");
 const editable=["dosen","admin","super_admin"].includes(role);
 const publish=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{
  await postJson("/api/announcements",{classId:classId||null,audience,title,body,pinned,expiresAt:expiry?wibToIso(expiry):null});
  setOpen(false);setTitle("");setBody("");setPinned(false);router.refresh();
 }catch(e){setError(e instanceof Error?e.message:"Gagal mengirim pengumuman.");}finally{setBusy(false);}};
 return <>
  {editable&&<div className="action-strip"><span>Publikasikan informasi akademik. Penerima memperoleh notifikasi otomatis.</span><button className="btn btn-primary" onClick={()=>setOpen(v=>!v)}><i className="bi bi-megaphone"/> {open?"Tutup formulir":"Buat pengumuman"}</button></div>}
  {open&&<section className="panel" style={{marginBottom:20}}><div className="panelhead"><h2>Pengumuman baru</h2><Tag kind="blue">Notifikasi otomatis</Tag></div><form onSubmit={publish} className="stack">
   <div className="form-grid"><div className="field"><label htmlFor="announcement-scope">Untuk kelas</label><select id="announcement-scope" className="select" value={classId} onChange={e=>setClassId(e.target.value)} required={role==="dosen"}><option value="" disabled={role==="dosen"}>{role==="dosen"?"Pilih kelas yang diampu":"Seluruh kampus"}</option>{classes.map(c=><option key={c.id} value={c.id}>{c.courses.name_id} · {c.class_code}</option>)}</select></div>
   <div className="field"><label htmlFor="announcement-audience">Penerima</label><select id="announcement-audience" className="select" value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">Semua anggota lingkup</option><option value="mahasiswa">Mahasiswa</option>{role!=="dosen"&&<><option value="dosen">Dosen</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></>}</select></div>
   <div className="field"><label htmlFor="announcement-expire">Berakhir (WIB, opsional)</label><input type="datetime-local" className="input" id="announcement-expire" value={expiry} onChange={e=>setExpiry(e.target.value)}/></div>
   <div className="field" style={{justifyContent:"end"}}><label className="checkline"><input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)}/> Sematkan di atas</label></div></div>
   <div className="field"><label htmlFor="announcement-title">Judul</label><input id="announcement-title" className="input" value={title} maxLength={150} minLength={5} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Perubahan lokasi pertemuan" required/></div>
   <div className="field"><label htmlFor="announcement-body">Isi pengumuman</label><textarea id="announcement-body" className="textarea" rows={5} value={body} minLength={10} maxLength={4000} onChange={e=>setBody(e.target.value)} required/></div>
   {error&&<div className="feedback error" role="alert">{error}</div>}
   <div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy?"Menerbitkan...":"Terbitkan dan kirim notifikasi"}</button><button type="button" className="btn btn-secondary" onClick={()=>setOpen(false)}>Batal</button></div>
  </form></section>}
  <div className="announcement-grid">{rows.map(a=><article className="panel" key={a.id}><div className="chip-row"><Tag kind={a.pinned?"warn":"blue"}>{a.pinned?"Disematkan":"Pengumuman"}</Tag><Tag kind="neutral">{a.classes?.class_code||"Semua kampus"}</Tag></div><h2 style={{margin:"14px 0 8px"}}>{a.title}</h2><p className="preline" style={{color:"#475569"}}>{a.body}</p><div className="meta-line"><time>{dateTimeWib(a.created_at)}</time>{a.classes&&<Link href={`/kelas/${a.class_id}`}>Detail kelas</Link>}</div></article>)}</div>
  {rows.length===0&&<Empty title="Belum ada pengumuman" message="Pengumuman dari dosen dan pengelola akademik akan muncul di sini." icon="megaphone"/>}
 </>;
}
