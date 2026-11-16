"use client";
import {useEffect,useState} from "react";import Link from "next/link";
import type {Notification} from "@/types/domain";
import {browserClient} from "@/lib/supabase/browser";import {postJson} from "@/lib/utils/request";
import {Empty,Tag} from "@/components/UI";
function decodeVapid(key:string){const padding="=".repeat((4-key.length%4)%4);const raw=atob((key+padding).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export function NotificationCenter({initial,userId}:{initial:Notification[];userId:string}){
 const [rows,setRows]=useState(initial);const [pushStatus,setPushStatus]=useState("");const [toast,setToast]=useState("");
 useEffect(()=>{const client=browserClient();const channel=client.channel(`notifications-${userId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${userId}`},payload=>{
 const notification=payload.new as Notification;setRows(v=>[notification,...v]);setToast(notification.title);
 }).subscribe();return ()=>{void client.removeChannel(channel);};},[userId]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),4500);return ()=>clearTimeout(t);},[toast]);
 const mark=async(id:string)=>{try{await postJson("/api/notifications/read",{notificationId:id});setRows(v=>v.map(n=>n.id===id?{...n,is_read:true}:n));}catch(e){setPushStatus(e instanceof Error?e.message:"Gagal menandai notifikasi.");}};
 const enable=async()=>{setPushStatus("");try{
  if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error("Browser belum mendukung web push.");
  if(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)throw new Error("VAPID public key belum dikonfigurasi.");
  const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("Izin notifikasi belum diberikan.");
  const registration=await navigator.serviceWorker.register("/sw.js");const ready=await navigator.serviceWorker.ready;
  const subscription=await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapid(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)});
  await postJson("/api/push/subscribe",subscription.toJSON());setPushStatus("Notifikasi push berhasil diaktifkan.");void registration;
 }catch(e){setPushStatus(e instanceof Error?e.message:"Tidak dapat mengaktifkan notifikasi.");}};
 return <><div className="panel" style={{marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}><div><strong>Notifikasi saat aplikasi tertutup</strong><div className="subtle tiny">Aktifkan untuk pengingat kelas H-30 dan H-10 menit.</div></div><button className="btn btn-primary" onClick={enable}><i className="bi bi-bell-fill"/> Aktifkan Push</button>{pushStatus&&<div className="feedback" style={{width:"100%"}}>{pushStatus}</div>}</div>
 <div className="bell-list">{rows.map(n=><article className={`bell-entry ${n.is_read?"":"unread"}`} key={n.id}><div className="class-mini-icon"><i className={`bi bi-${n.category==="LIVE_CLASS"?"broadcast":n.category==="RPS"?"patch-check":"bell"}`}/></div><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><h3>{n.title}</h3>{!n.is_read&&<Tag kind="blue">Baru</Tag>}</div><p>{n.message}</p><time>{new Date(n.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"})} WIB</time><div className="form-actions">{n.action_url?.startsWith("/")&&!n.action_url.startsWith("//")&&<Link className="btn btn-secondary btn-sm" href={n.action_url}>Lihat detail</Link>}{!n.is_read&&<button className="btn btn-quiet btn-sm" onClick={()=>mark(n.id)}>Tandai dibaca</button>}</div></div></article>)}</div>
 {!rows.length&&<Empty icon="bell-slash" title="Belum ada notifikasi" message="Pengingat jadwal dan informasi kelas terbaru akan muncul di sini."/>}{toast&&<div className="toast" role="status"><i className="bi bi-bell-fill"/> {toast}</div>}</>;
}
