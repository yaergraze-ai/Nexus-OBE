"use client";
import {useEffect,useState} from "react";
import {browserClient} from "@/lib/supabase/browser";
export function AccountSecurity(){
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [linked,setLinked]=useState(false);
 useEffect(()=>{void browserClient().auth.getUserIdentities().then(({data})=>setLinked(Boolean(data?.identities?.some(i=>i.provider==="google"))));},[]);
 const change=async(e:React.FormEvent)=>{e.preventDefault();setMessage("");if(password!==confirm)return setMessage("Konfirmasi kata sandi berbeda.");setBusy(true);try{
  const {error}=await browserClient().auth.updateUser({password});if(error)throw error;setPassword("");setConfirm("");setMessage("Kata sandi baru tersimpan.");
 }catch(e){setMessage(e instanceof Error?e.message:"Gagal memperbarui kata sandi.");}finally{setBusy(false);}};
 const link=async()=>{setBusy(true);setMessage("");try{
  const {data:{user}}=await browserClient().auth.getUser();if(!user?.email_confirmed_at)throw new Error("Email belum diverifikasi.");
  const {error}=await browserClient().auth.linkIdentity({provider:"google",options:{redirectTo:`${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/pengaturan/keamanan")}`}});if(error)throw error;
 }catch(e){setMessage(e instanceof Error?e.message:"Tidak bisa menghubungkan Google.");setBusy(false);}};
 return <section className="panel"><div className="panelhead"><h2>Google dan kata sandi</h2></div><p className="subtle">Satu akun kampus, dua cara login. Hubungkan Google dengan email yang persis sama.</p><div className="notice" style={{marginBottom:20}}>{linked?"Google sudah terhubung ke akun ini.":"Google belum terhubung. Aktifkan manual identity linking pada Supabase untuk memakai tombol ini."}</div>{!linked&&<button className="btn btn-secondary" onClick={link} disabled={busy}><i className="bi bi-google"/> Hubungkan akun Google</button>}
 <form onSubmit={change} style={{marginTop:20}}><div className="field"><label htmlFor="password-new">Kata sandi baru</label><input id="password-new" className="input" autoComplete="new-password" type="password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="field"><label htmlFor="password-confirm">Ulangi kata sandi baru</label><input id="password-confirm" className="input" autoComplete="new-password" type="password" minLength={12} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div><button className="btn btn-primary" disabled={busy} style={{marginTop:16}}>{busy?"Menyimpan...":"Ganti kata sandi"}</button></form>{message&&<p className="notice" role="status">{message}</p>}</section>;
}
