import {NextResponse} from "next/server";
import {apiSession,boundedJson} from "@/lib/security/api-session";import {scheduleSchema} from "@/lib/validators";import {apiError} from "@/lib/api";
import {classRecipientIds,deliver} from "@/lib/security/notifications";
export async function POST(req:Request){try{
 const {db}=await apiSession(["admin","super_admin"]);const v=scheduleSchema.parse(await boundedJson(req));
 const {data:old}=await db.from("classes").select("uts_schedule,uas_schedule").eq("id",v.classId).single();
 const {error}=await db.rpc("update_class_schedule",{p_class_id:v.classId,p_day:v.day,p_start:v.start,p_end:v.end,p_room:v.room,p_uts:v.uts,p_uas:v.uas});if(error)throw new Error(error.message);
 try{const recipients=await classRecipientIds(v.classId);
 await deliver(recipients,{title:"Jadwal kuliah diperbarui",body:`Jadwal baru: ${v.day}, ${v.start.slice(0,5)}–${v.end.slice(0,5)} • ${v.room}`,category:"SCHEDULE",url:`/kelas/${v.classId}`},true);
 if((!old?.uts_schedule&&v.uts)||(!old?.uas_schedule&&v.uas))await deliver(recipients,{title:"Jadwal ujian diterbitkan",body:"Jadwal UTS/UAS baru tersedia. Periksa detail kelas.",category:"EXAM",url:`/kelas/${v.classId}`},true);
 }catch(e){console.error(e);}
 return NextResponse.json({ok:true});
}catch(e){return apiError(e);}}
