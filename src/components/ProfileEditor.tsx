"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {compressBapImage} from "@/lib/utils/image-compressor";
export function ProfileEditor({initialName}:{initialName:string}){
 const [name,setName]=useState(initialName),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");const router=useRouter();
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{
  const res=await fetch("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({full_name:name})});
  if(!res.ok)throw new Error((await res.json()).error||"Perubahan gagal");
  if(file){const compressed=await compressBapImage(file);const form=new FormData();form.set("photo",compressed);const uploaded=await fetch("/api/profile/avatar",{method:"POST",body:form});if(!uploaded.ok)throw new Error((await uploaded.json()).error||"Upload foto gagal");}
  setMessage("Profil berhasil disimpan.");setFile(null);router.refresh();
 }catch(e){setMessage(e instanceof Error?e.message:"Gagal menyimpan profil.");}finally{setBusy(false);}};
 return <form onSubmit={save} className="stack"><div className="field"><label htmlFor="full_name">Nama tampilan</label><input id="full_name" className="input" value={name} minLength={3} maxLength={150} required onChange={e=>setName(e.target.value)}/></div><div className="field"><label htmlFor="profile-photo">Foto profil (WebP/JPG/PNG)</label><input id="profile-photo" type="file" accept="image/*" className="input" onChange={e=>setFile(e.target.files?.[0]||null)}/><span className="field-hint">Foto otomatis dikompresi ke WebP, maksimal 500 KB.</span></div><button className="btn btn-primary" disabled={busy}>{busy?"Menyimpan...":"Simpan profil"}</button>{message&&<p role="status" className="notice">{message}</p>}</form>;
}
