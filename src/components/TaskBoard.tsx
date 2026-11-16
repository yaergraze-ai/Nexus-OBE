"use client";
import Link from "next/link";import {useRouter} from "next/navigation";import {useState} from "react";
import type {AcademicClass,Role} from "@/types/domain";
import type {Assignment,Submission,TaskComponent} from "@/types/coursework";
import {COMPONENT_LABEL} from "@/types/coursework";
import {dateTimeWib,wibInput,wibToIso} from "@/lib/utils/wib";
import {postJson} from "@/lib/utils/request";
import {Empty,Tag} from "@/components/UI";
export function TaskBoard({assignments,classes,submissions,role}:{assignments:Assignment[];classes:AcademicClass[];submissions:Submission[];role:Role}){
 const router=useRouter();const [editing,setEditing]=useState<Assignment|null>(null);const [open,setOpen]=useState(false);
 const [klass,setKlass]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");
 const [component,setComponent]=useState<TaskComponent>("daily_task");const [links,setLinks]=useState<string[]>([""]);const [due,setDue]=useState("");const [late,setLate]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const add=()=>{setEditing(null);setKlass(classes[0]?.id||"");setTitle("");setDescription("");setComponent("daily_task");setLinks([""]);setDue("");setLate(false);setOpen(true);setError("");};
 const edit=(a:Assignment)=>{setEditing(a);setKlass(a.class_id);setTitle(a.title);setDescription(a.description);setComponent(a.component);setLinks(a.resource_links.length?a.resource_links:[""]);setDue(wibInput(a.due_at));setLate(a.accept_late);setOpen(true);setError("");};
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{
  const dueAt=wibToIso(due);await postJson("/api/assignments",{id:editing?.id??null,classId:klass,title,description,component,links:links.map(s=>s.trim()).filter(Boolean),dueAt,acceptLate:late});
  setOpen(false);router.refresh();
 }catch(e){setError(e instanceof Error?e.message:"Tugas gagal disimpan.");}finally{setBusy(false);}};
 return <>
  {role==="dosen"&&<div className="action-strip"><span>Buat tugas dengan kategori nilai PAP, tenggat WIB, dan lampiran materi.</span><button className="btn btn-primary" onClick={add}><i className="bi bi-plus-circle"/>Buat tugas</button></div>}
  {open&&<section className="panel" style={{marginBottom:20}}><div className="panelhead"><h2>{editing?"Ubah tugas":"Tugas baru"}</h2><Tag kind="blue">Nilai tersambung PAP</Tag></div><form onSubmit={save} className="stack">
   <div className="form-grid"><div className="field"><label htmlFor="task-class">Kelas</label><select id="task-class" className="select" value={klass} disabled={Boolean(editing)} onChange={e=>setKlass(e.target.value)} required>{classes.map(c=><option key={c.id} value={c.id}>{c.courses.name_id} · {c.class_code}</option>)}</select></div>
   <div className="field"><label htmlFor="task-component">Komponen PAP</label><select id="task-component" className="select" value={component} onChange={e=>setComponent(e.target.value as TaskComponent)}>{(Object.keys(COMPONENT_LABEL) as TaskComponent[]).map(k=><option key={k} value={k}>{COMPONENT_LABEL[k]}</option>)}</select></div>
   <div className="field"><label htmlFor="task-due">Tenggat (WIB)</label><input id="task-due" type="datetime-local" className="input" value={due} onChange={e=>setDue(e.target.value)} required/></div>
   <div className="field"><label className="checkline"><input type="checkbox" checked={late} onChange={e=>setLate(e.target.checked)}/> Izinkan pengumpulan terlambat</label></div></div>
   <div className="field"><label htmlFor="task-title">Judul</label><input id="task-title" className="input" minLength={5} maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} required/></div>
   <div className="field"><label htmlFor="task-description">Instruksi tugas</label><textarea id="task-description" className="textarea" rows={5} minLength={10} maxLength={6000} value={description} onChange={e=>setDescription(e.target.value)} required/></div>
   <div className="field"><label>Tautan referensi (opsional)</label>{links.map((value,index)=><div key={index} className="link-edit-row"><input aria-label={`Tautan referensi ${index+1}`} className="input" value={value} placeholder="https://github.com/..." onChange={e=>setLinks(v=>v.map((s,i)=>i===index?e.target.value:s))}/><button type="button" className="btn btn-secondary" onClick={()=>setLinks(v=>v.filter((_,i)=>i!==index))} aria-label="Hapus tautan"><i className="bi bi-x-lg"/></button></div>)}<button type="button" className="btn btn-secondary btn-sm" onClick={()=>setLinks(v=>[...v,""])}>Tambah tautan</button></div>
   {error&&<div className="feedback error" role="alert">{error}</div>}
   <div className="form-actions"><button className="btn btn-primary" disabled={busy||!klass}>{busy?"Menyimpan...":"Simpan dan umumkan tugas"}</button><button type="button" className="btn btn-secondary" onClick={()=>setOpen(false)}>Batal</button></div>
  </form></section>}
  <div className="assignment-grid">{assignments.map(a=>{
   const own=submissions.find(s=>s.assignment_id===a.id);
   const expired=new Date(a.due_at)<=new Date();return <article className="panel assignment-card" key={a.id}>
   <div className="chip-row"><Tag kind="neutral">{a.classes?.class_code}</Tag><Tag kind="blue">{COMPONENT_LABEL[a.component]}</Tag><Tag kind={expired&&!a.accept_late?"bad":own?.status==="SUBMITTED"?"good":"warn"}>{expired&&!a.accept_late?"Ditutup":own?.status==="SUBMITTED"?"Dikumpulkan":"Terbuka"}</Tag></div>
   <h2 style={{margin:"15px 0 7px"}}><Link href={`/tugas/${a.id}`}>{a.title}</Link></h2><p className="subtle tiny">{a.classes?.courses?.name_id}</p><p className="task-summary">{a.description}</p><div className="stat-line"><span>Tenggat</span><strong>{dateTimeWib(a.due_at)}</strong></div>
   {own&&<div className="stat-line"><span>Revisi / Nilai</span><strong>v{own.revision} · {own.score==null?"Belum dinilai":`${own.score}/100`}</strong></div>}
   <div className="form-actions"><Link href={`/tugas/${a.id}`} className="btn btn-primary btn-sm">{role==="mahasiswa"?"Buka pengumpulan":"Lihat pengumpulan"}</Link>{role==="dosen"&&<button className="btn btn-secondary btn-sm" onClick={()=>edit(a)}>Ubah tugas</button>}</div>
  </article>})}</div>
  {!assignments.length&&<Empty icon="clipboard-check" title="Belum ada tugas" message="Tugas dari dosen untuk kelas yang diikuti akan tampil di sini."/>}
 </>;
}
