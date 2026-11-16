import type { ScoreInput, RpsCpl, RpsCpmk, RpsSub } from "@/types/domain";
export const PAP_WEIGHTS:Readonly<ScoreInput> = {attendance:10,uts:20,uas:20,daily_task:20,group_task:20,major_project:10};
const fields = Object.keys(PAP_WEIGHTS) as (keyof ScoreInput)[];
function scoreInRange(n:number):boolean {return Number.isFinite(n)&&n>=0&&n<=100;}
export function calculateFinal(scores:ScoreInput,weights:ScoreInput=PAP_WEIGHTS){
  if(fields.some((k)=>!scoreInRange(scores[k]))||fields.some((k)=>!Number.isInteger(weights[k])||weights[k]<0)||fields.reduce((s,k)=>s+weights[k],0)!==100) throw new Error("Nilai harus 0–100 dan total bobot tepat 100%.");
  const numeric= Math.round(fields.reduce((s,k)=>s+scores[k]*weights[k]/100,0)*100)/100;
  const letter=numeric>=85?"A":numeric>=70?"B":numeric>=55?"C":numeric>=40?"D":"E";
  const quality=({A:4,B:3,C:2,D:1,E:0} as const)[letter];
  return {numeric,letter,quality};
}
export function coursePassed(quality:number, target:number):boolean {return quality>=target;}
export function calculateCplAttainment(scores:ScoreInput,cpls:RpsCpl[],cpmks:RpsCpmk[],subs:RpsSub[]){
  if(fields.some((k)=>!scoreInRange(scores[k]))) throw new Error("Nilai komponen harus 0–100.");
  return cpls.map(cpl=>{
    const cpmkIds=new Set(cpmks.filter(c=>c.cpl_id===cpl.id).map(c=>c.id));
    const rows=subs.filter(s=>cpmkIds.has(s.cpmk_id));
    const totalWeight=rows.reduce((sum,s)=>sum+s.weight,0);
    const weighted=rows.reduce((sum,s)=>sum+s.weight_uts*scores.uts+s.weight_uas*scores.uas+s.weight_a*scores.daily_task+s.weight_b*scores.group_task+s.weight_c*scores.major_project,0);
    return {code:cpl.code,weight:cpl.weight,attainment:totalWeight>0?Math.round(weighted/totalWeight*100)/100:null};
  });
}
export function validRpsWeights(cpls:Pick<RpsCpl,"weight">[],cpmks:Pick<RpsCpmk,"weight">[],subs:Pick<RpsSub,"weight"|"weight_uts"|"weight_uas"|"weight_a"|"weight_b"|"weight_c">[]):boolean {
  const sum=(rows:{weight:number}[])=>rows.reduce((s,r)=>s+r.weight,0);
  return cpls.length>0&&cpmks.length>0&&subs.length>0&&sum(cpls)===100&&sum(cpmks)===100&&sum(subs)===100&&subs.every(s=>s.weight===s.weight_uts+s.weight_uas+s.weight_a+s.weight_b+s.weight_c);
}
