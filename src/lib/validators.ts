import { z } from "zod";
const uuid=z.uuid();
export const startMeetingSchema=z.object({
 classId:uuid,type:z.enum(["KULIAH","PRAKTIKUM","PENGGANTI","UTS","UAS"]),summary:z.string().trim().min(10).max(2000)
});
export const scoreSchema=z.object({classId:uuid,studentId:uuid,scores:z.object({
 attendance:z.number().min(0).max(100),uts:z.number().min(0).max(100),uas:z.number().min(0).max(100),daily_task:z.number().min(0).max(100),group_task:z.number().min(0).max(100),major_project:z.number().min(0).max(100)
})});
export const scheduleSchema=z.object({classId:uuid,day:z.enum(["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"]),start:z.iso.time(),end:z.iso.time(),room:z.string().trim().min(3).max(100),uts:z.iso.datetime({offset:true}).nullable(),uas:z.iso.datetime({offset:true}).nullable()}).refine(v=>v.start<v.end,{message:"Jam selesai harus setelah jam mulai."});
export const rpsSchema=z.object({classId:uuid,cpls:z.array(z.object({code:z.string().min(2).max(15),description:z.string().min(10).max(1500),weight:z.number().int().min(0).max(100),cpmks:z.array(z.object({code:z.string().min(2).max(15),description:z.string().min(10).max(1500),weight:z.number().int().min(0).max(100),subs:z.array(z.object({code:z.string().min(2).max(20),description:z.string().min(10).max(1500),weight:z.number().int().min(0).max(100),weight_uts:z.number().int().min(0).max(100),weight_uas:z.number().int().min(0).max(100),weight_a:z.number().int().min(0).max(100),weight_b:z.number().int().min(0).max(100),weight_c:z.number().int().min(0).max(100)})).min(1).max(30)})).min(1).max(20)})).min(1).max(20)}).superRefine((v,ctx)=>{
 const sum=(a:{weight:number}[])=>a.reduce((x,y)=>x+y.weight,0);
 const cpmks=v.cpls.flatMap(c=>c.cpmks);const subs=cpmks.flatMap(c=>c.subs);
 if(sum(v.cpls)!==100||sum(cpmks)!==100||sum(subs)!==100)ctx.addIssue({code:"custom",message:"Total bobot CPL, CPMK dan Sub-CPMK masing-masing wajib 100%."});
 for(const c of v.cpls)if(sum(c.cpmks)!==c.weight)ctx.addIssue({code:"custom",message:`Bobot CPMK untuk ${c.code} harus ${c.weight}%.`});
 for(const c of cpmks)if(sum(c.subs)!==c.weight)ctx.addIssue({code:"custom",message:`Bobot Sub-CPMK untuk ${c.code} harus ${c.weight}%.`});
 for(const s of subs)if(s.weight!==s.weight_uts+s.weight_uas+s.weight_a+s.weight_b+s.weight_c)ctx.addIssue({code:"custom",message:`Matriks ${s.code} tidak sama dengan bobotnya.`});
});
export const subscriptionSchema=z.object({endpoint:z.url().max(2048).refine(s=>s.startsWith("https://")),keys:z.object({p256dh:z.string().min(20).max(512),auth:z.string().min(8).max(256)})});
