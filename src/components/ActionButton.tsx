"use client";
import {useState} from "react";import {useRouter} from "next/navigation";
import {postJson} from "@/lib/utils/request";
export function ActionButton({url,payload,label,icon="check2",kind="primary",disabled=false,confirm}:{url:string;payload:unknown;label:string;icon?:string;kind?:"primary"|"secondary"|"green"|"quiet";disabled?:boolean;confirm?:string}){
 const [pending,setPending]=useState(false);const [feedback,setFeedback]=useState("");const router=useRouter();
 const click=async()=>{if(confirm&&!window.confirm(confirm))return;setPending(true);setFeedback("");try{await postJson(url,payload);setFeedback("Perubahan berhasil disimpan.");router.refresh();}catch(e){setFeedback(e instanceof Error?e.message:"Tindakan gagal.");}finally{setPending(false);}};
 return <span style={{display:"inline-flex",flexDirection:"column",alignItems:"start",gap:5}}><button className={`btn btn-${kind} btn-sm`} onClick={click} disabled={disabled||pending}><i className={`bi bi-${icon}`}/>{pending?"Memproses...":label}</button>{feedback&&<span role="status" className="tiny" style={{color:feedback.startsWith("Perubahan")?"#16834e":"#a62c35",maxWidth:240}}>{feedback}</span>}</span>;
}
