import "server-only";
import webPush from "web-push";
import {adminClient} from "@/lib/supabase/admin";
import type {AcademicClass} from "@/types/domain";
function vapidReady(){return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);}
export async function classRecipientIds(classId:string):Promise<string[]>{
 const admin=adminClient();const {data:klass}=await admin.from("classes").select("lecturer_identity_number").eq("id",classId).single();
 if(!klass)return [];
 const [students,lecturers]=await Promise.all([
  admin.from("class_enrollments").select("student_id").eq("class_id",classId),
  admin.from("profiles").select("id").eq("identity_number",klass.lecturer_identity_number).eq("is_active",true)
 ]);
 return [...new Set([...(students.data??[]).map(x=>x.student_id),...(lecturers.data??[]).map(x=>x.id)])];
}
export async function deliver(ids:string[],payload:{title:string;body:string;category:string;url:string},email=false,persist=true){
 if(!ids.length)return;
 const admin=adminClient();const unique=[...new Set(ids)];
 if(persist){const {error}=await admin.from("notifications").insert(unique.map(id=>({user_id:id,title:payload.title,message:payload.body,category:payload.category,action_url:payload.url})));
 if(error)throw new Error(error.message);}
 if(vapidReady()){
  webPush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
  const {data:subs}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id",unique);
  await Promise.allSettled((subs??[]).map(async sub=>{
   try {await webPush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{TTL:3600});}
   catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await admin.from("push_subscriptions").delete().eq("id",sub.id);}
  }));
 }
 if(email&&process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL){
  const {data:profiles}=await admin.from("profiles").select("email").in("id",unique).eq("is_active",true);
  for(const p of profiles??[]){
   try{await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[p.email],subject:payload.title,text:`${payload.body}\n\nBuka portal akademik untuk detail.`})});}catch{/* email opsional, notifikasi in-app sudah tersimpan */}
  }
 }
}
export function classLabel(klass:AcademicClass){return `${klass.courses.name_id} • ${klass.class_code}`;}
