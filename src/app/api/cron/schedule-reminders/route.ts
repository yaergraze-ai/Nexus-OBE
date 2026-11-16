import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {adminClient} from "@/lib/supabase/admin";
import {classRecipientIds,deliver} from "@/lib/security/notifications";
import type {Day} from "@/types/domain";
export const runtime="nodejs";
function authorized(given:string|null,expected:string|undefined){if(!expected||!given)return false;const a=Buffer.from(given),b=Buffer.from(`Bearer ${expected}`);return a.length===b.length&&timingSafeEqual(a,b);}
export async function GET(req:Request){
 if(!authorized(req.headers.get("authorization"),process.env.CRON_SECRET))return NextResponse.json({error:"Unauthorized"},{status:401});
 const db=adminClient();const {error:closeError}=await db.rpc("close_expired_meetings");if(closeError)return NextResponse.json({error:closeError.message},{status:500});
 const now=new Date();const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",weekday:"long",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
 const val=(type:string)=>parts.find(p=>p.type===type)?.value??"";
 const day=({Monday:"Senin",Tuesday:"Selasa",Wednesday:"Rabu",Thursday:"Kamis",Friday:"Jumat",Saturday:"Sabtu",Sunday:"Minggu"} as Record<string,Day>)[val("weekday")];
 const hh=Number(val("hour")),mm=Number(val("minute")),minutes=hh*60+mm;const date=`${val("year")}-${val("month")}-${val("day")}`;
 const {data:classes,error}=await db.from("classes").select("id,class_code,schedule_day,start_time,rps_validated_kaprodi,rps_validated_dekan,pbm_period,lecturer_identity_number,courses(name_id)").eq("pbm_period","on");
 if(error)return NextResponse.json({error:error.message},{status:500});
 let sent=0;let failed=0;
 for(const klass of classes??[]){
  const reminders:Array<{key:string;title:string;body:string;category:string;url:string}>=[];
  if(klass.schedule_day===day){const [h,m]=klass.start_time.split(":").map(Number);const until=h*60+m-minutes;
   if(until>=25&&until<=30)reminders.push({key:`reminder:${klass.id}:${date}:H30`,title:"Kuliah dalam 30 menit",body:`Kelas ${klass.class_code} dimulai pukul ${klass.start_time.slice(0,5)} WIB.`,category:"SCHEDULE",url:`/kelas/${klass.id}`});
   if(until>=5&&until<=10)reminders.push({key:`reminder:${klass.id}:${date}:H10`,title:"Kuliah dalam 10 menit",body:`Siapkan diri untuk kelas ${klass.class_code}.`,category:"SCHEDULE",url:`/kelas/${klass.id}`});
  }
  if(["Senin","Selasa","Rabu","Kamis","Jumat"].includes(day)&&hh===8&&mm<5&&!(klass.rps_validated_kaprodi&&klass.rps_validated_dekan))
   reminders.push({key:`rps:${klass.id}:${date}`,title:"RPS memerlukan validasi",body:`RPS kelas ${klass.class_code} belum disetujui kedua pejabat.`,category:"RPS",url:`/kelas/${klass.id}/rps`});
  for(const reminder of reminders){
   const {data:log,error:logErr}=await db.from("notification_dispatch_logs").upsert({idempotency_key:reminder.key},{onConflict:"idempotency_key",ignoreDuplicates:true}).select("idempotency_key");
   if(logErr){failed++;continue;}if(!log?.length)continue;
   try{
    let recipients=await classRecipientIds(klass.id);
    if(reminder.category==="RPS"){
     const {data:admins}=await db.from("profiles").select("id").in("role",["admin","super_admin"]).eq("is_active",true);
     recipients=[...new Set([...recipients,...(admins??[]).map(p=>p.id)])];
    }
    await deliver(recipients,{title:reminder.title,body:reminder.body,category:reminder.category,url:reminder.url},reminder.category==="RPS");sent++;
   }catch(e){console.error("cron delivery failed",e);await db.from("notification_dispatch_logs").delete().eq("idempotency_key",reminder.key);failed++;}
  }
 }
 // Assignment deadlines: once H-24 and H-1 hour, only students not yet submitted.
 const {data:tasks,error:taskError}=await db.from("assignments").select("id,class_id,title,due_at")
  .eq("published",true).gt("due_at",now.toISOString()).lte("due_at",new Date(now.getTime()+24*3600*1000).toISOString());
 if(taskError)return NextResponse.json({error:taskError.message},{status:500});
 for(const task of tasks??[]){
  const remaining=(new Date(task.due_at).getTime()-now.getTime())/60000;
  const tag=remaining>=1430&&remaining<=1440?"H24":remaining>=50&&remaining<=60?"H1":null;
  if(!tag)continue;
  const key=`task:${task.id}:${task.due_at}:${tag}`;
  const {data:log,error:logError}=await db.from("notification_dispatch_logs")
   .upsert({idempotency_key:key},{onConflict:"idempotency_key",ignoreDuplicates:true}).select("idempotency_key");
  if(logError){failed++;continue;}if(!log?.length)continue;
  try{
   const [{data:enrollments,error:eError},{data:submitted,error:sError}]=await Promise.all([
    db.from("class_enrollments").select("student_id").eq("class_id",task.class_id),
    db.from("assignment_submissions").select("student_id").eq("assignment_id",task.id).eq("status","SUBMITTED")
   ]);
   if(eError||sError)throw new Error(eError?.message||sError?.message);
   const done=new Set((submitted??[]).map(s=>s.student_id));
   const targets=(enrollments??[]).map(e=>e.student_id).filter(id=>!done.has(id));
   await deliver(targets,{title:tag==="H24"?"Tugas berakhir besok":"Tugas berakhir dalam 1 jam",
    body:`${task.title} belum dikumpulkan. Tenggat ${new Date(task.due_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} WIB.`,
    category:"ASSIGNMENT",url:`/tugas/${task.id}`});sent++;
  }catch(e){console.error("assignment reminder failed",e);await db.from("notification_dispatch_logs").delete().eq("idempotency_key",key);failed++;}
 }
 return NextResponse.json({ok:true,sent,failed,checked_at:now.toISOString()});
}
