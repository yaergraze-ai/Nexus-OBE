"use client";
import {useRef,useState} from "react";import {useRouter} from "next/navigation";
import type {Submission,WorkFile} from "@/types/coursework";
import {postJson} from "@/lib/utils/request";import {dateTimeWib} from "@/lib/utils/wib";
import {Tag} from "@/components/UI";
export function FileList({files,canRemove=false,kind="submission"}:{files:WorkFile[];canRemove?:boolean;kind?:"submission"|"material"}){
 const router=useRouter();const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState("");
 const remove=async(id:string)=>{if(!window.confirm("Hapus lampiran ini?"))return;setBusy(id);setError("");try{
  const response=await fetch("/api/assignments/files",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileId:id,kind})});
  const payload=await response.json() as {error?:string};if(!response.ok)throw new Error(payload.error||"Gagal menghapus file.");router.refresh();
 }catch(e){setError(e instanceof Error?e.message:"Gagal menghapus berkas.");}finally{setBusy(null);}};
 return <>{files.length>0&&<div className="attachments-list">{files.map(f=><div className="file-row" key={f.id}><i className="bi bi-paperclip"/><div className="file-row-label"><strong>{f.file_name}</strong><span>{(f.byte_size/1024).toFixed(0)} KB · Akses privat</span></div>{f.signedUrl?<a href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Buka <i className="bi bi-box-arrow-up-right"/></a>:<Tag kind="warn">Tautan belum tersedia</Tag>}{canRemove&&<button className="btn btn-secondary btn-sm" onClick={()=>remove(f.id)} disabled={busy===f.id} aria-label={`Hapus ${f.file_name}`}><i className="bi bi-trash"/></button>}</div>)}</div>}{error&&<div className="feedback error" role="alert">{error}</div>}</>;
}
export function UploadAttachments({targetId,kind,enabled}:{targetId:string;kind:"submission"|"material";enabled:boolean}){
 const router=useRouter();const picker=useRef<HTMLInputElement|null>(null);const [busy,setBusy]=useState(false);const [progress,setProgress]=useState("");const [error,setError]=useState("");
 const upload=async()=>{if(!picker.current?.files?.length)return;setBusy(true);setError("");try{
  const files=[...picker.current.files];for(let i=0;i<files.length;i++){
   if(files[i].size>10*1024*1024)throw new Error(`${files[i].name}: maksimal 10 MB per file.`);
   setProgress(`Mengunggah ${i+1} dari ${files.length}: ${files[i].name}`);
   const body=new FormData();body.set("kind",kind);body.set("targetId",targetId);body.set("file",files[i]);
   const response=await fetch("/api/assignments/files",{method:"POST",body});const payload=await response.json() as {error?:string};
   if(!response.ok)throw new Error(payload.error||"Gagal mengunggah lampiran.");
  }
  picker.current.value="";setProgress(`${files.length} file berhasil diunggah.`);router.refresh();
 }catch(e){setError(e instanceof Error?e.message:"Gagal mengunggah lampiran.");}finally{setBusy(false);}};
 return <div className="upload-card"><label htmlFor={`picker-${kind}`}>Tambahkan lampiran (PDF, gambar, ZIP, Office, TXT/MD/CSV; ≤10 MB per file)</label><div className="upload-input-row"><input ref={picker} id={`picker-${kind}`} className="input" type="file" multiple disabled={!enabled||busy} accept=".pdf,.png,.jpeg,.jpg,.webp,.zip,.docx,.xlsx,.pptx,.txt,.md,.csv"/><button type="button" className="btn btn-secondary" disabled={!enabled||busy} onClick={upload}>{busy?"Mengunggah...":"Unggah file"}</button></div><p className="field-hint">Boleh menambah file kembali kapan saja selama pengumpulan terbuka. Berkas bersifat privat dan dapat dihapus oleh pemilik.</p>{progress&&<p className="subtle tiny" aria-live="polite">{progress}</p>}{error&&<div className="feedback error" role="alert">{error}</div>}</div>;
}
export function SubmissionEditor({assignmentId,existing,files,editable,deadline}:{assignmentId:string;existing:Submission|null;files:WorkFile[];editable:boolean;deadline:string}){
 const router=useRouter();const [content,setContent]=useState(existing?.content??"");const [links,setLinks]=useState<string[]>(existing?.links?.length?existing.links:[""]);
 const [submissionId,setSubmissionId]=useState(existing?.id??"");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [feedback,setFeedback]=useState("");
 const save=async(submit:boolean)=>{setBusy(true);setError("");setFeedback("");try{
  const submitted=await postJson<{id:string}>("/api/assignments/submissions",{assignmentId,content,links:links.map(v=>v.trim()).filter(Boolean),submit});
  setSubmissionId(submitted.id);setFeedback(submit?"Tugas berhasil dikumpulkan. Anda masih dapat merevisi selama batas waktu berlaku.":"Draf berhasil disimpan.");router.refresh();
 }catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan pengumpulan.");}finally{setBusy(false);}};
 return <section className="panel"><div className="panelhead"><h2>Pengumpulan Anda</h2><Tag kind={existing?.status==="SUBMITTED"?"good":"warn"}>{existing?.status==="SUBMITTED"?"Terkumpul":existing?"Draf":"Belum dikumpulkan"}</Tag></div>
  {existing&&<div className="stat-line"><span>Revisi terakhir</span><strong>v{existing.revision} {existing.submitted_at?`· ${dateTimeWib(existing.submitted_at)}`:""}</strong></div>}
  <p className="subtle tiny">Batas pengumpulan: {deadline}. {editable?"Teks, tautan, dan file dapat direvisi.":"Tenggat berakhir; pengumpulan dikunci."}</p>
  <div className="stack" style={{marginTop:18}}><div className="field"><label htmlFor="submission-content">Catatan atau deskripsi hasil pengerjaan</label><textarea id="submission-content" className="textarea" rows={5} maxLength={10000} value={content} disabled={!editable} onChange={e=>setContent(e.target.value)} placeholder="Jelaskan hasil, langkah pengerjaan, atau cara menjalankan proyek..."/></div>
  <div className="field"><label>Tautan hasil kerja (GitHub, Google Drive, Figma, atau HTTPS lainnya)</label>{links.map((value,index)=><div className="link-edit-row" key={index}><input className="input" aria-label={`Tautan hasil kerja ${index+1}`} type="url" placeholder="https://github.com/nama/repo" value={value} disabled={!editable} onChange={e=>setLinks(v=>v.map((s,i)=>i===index?e.target.value:s))}/>{editable&&<button type="button" className="btn btn-secondary" onClick={()=>setLinks(v=>v.filter((_,i)=>i!==index))} aria-label="Hapus tautan"><i className="bi bi-x"/></button>}</div>)}{editable&&<button className="btn btn-secondary btn-sm" type="button" onClick={()=>setLinks(v=>[...v,""])}>Tambah tautan</button>}<p className="field-hint">Gunakan tautan publik/berizin akses dosen. Menyimpan URL tidak mengubah izin akses Google Drive.</p></div>
  {error&&<div className="feedback error" role="alert">{error}</div>}{feedback&&<div className="feedback" role="status">{feedback}</div>}
  {editable&&<div className="form-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>save(false)}>{busy?"Menyimpan...":"Simpan draf"}</button><button className="btn btn-primary" disabled={busy} onClick={()=>save(true)}>{existing?.status==="SUBMITTED"?"Kumpulkan revisi":"Kumpulkan tugas"}</button></div>}
  <div><h3>Lampiran Anda ({files.length})</h3><FileList files={files} canRemove={editable}/>{files.length===0&&<p className="subtle tiny">Belum ada lampiran file.</p>}
  {editable&&submissionId?<UploadAttachments kind="submission" targetId={submissionId} enabled={editable}/>:editable?<div className="notice" style={{marginTop:14}}><i className="bi bi-info-circle"/><div><strong>Simpan draf terlebih dahulu</strong><p>Setelah draf tersimpan, Anda bisa mengunggah beberapa file sekaligus, lalu pilih Kumpulkan tugas.</p></div></div>:null}</div>
  {existing?.score!=null&&<div className="feedback"><strong>Nilai: {existing.score}/100</strong><p className="preline">{existing.feedback||"Tanpa catatan dosen"}</p></div>}
  </div>
 </section>;
}
export function GradeSubmissionForm({submission}:{submission:Submission}){
 const router=useRouter();const [score,setScore]=useState(String(submission.score??""));const [feedback,setFeedback]=useState(submission.feedback??"");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{await postJson("/api/assignments/grade",{submissionId:submission.id,score:Number(score),feedback});router.refresh();}catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan nilai.");}finally{setBusy(false);}};
 return <form className="grade-row" onSubmit={save}><div className="field"><label htmlFor={`grade-${submission.id}`}>Nilai (0–100)</label><input id={`grade-${submission.id}`} className="input" type="number" min={0} max={100} step="0.01" required value={score} onChange={e=>setScore(e.target.value)}/></div><div className="field"><label htmlFor={`feedback-${submission.id}`}>Umpan balik</label><input id={`feedback-${submission.id}`} className="input" value={feedback} maxLength={2500} onChange={e=>setFeedback(e.target.value)}/></div><button className="btn btn-primary" disabled={busy}>{busy?"Menyimpan...":"Simpan nilai"}</button>{error&&<p className="feedback error" role="alert">{error}</p>}</form>;
}
