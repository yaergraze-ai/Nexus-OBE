import type {Day} from "@/types/domain";
export type WeeklyCandidate={id:string;academic_year:string;class_code:string;lecturer_identity_number:string;schedule_day:Day;start_time:string;end_time:string;room_name:string;uts_schedule:string|null;uas_schedule:string|null;};
export type Conflict={otherId:string;otherClass:string;kind:"ROOM"|"LECTURER"|"COHORT"|"ENROLLMENT"|"EXAM";detail:string};
function timeMinutes(value:string){const [h,m]=value.split(":").map(Number);return h*60+m;}
function examRanges(c:WeeklyCandidate){return [c.uts_schedule,c.uas_schedule].filter((v):v is string=>Boolean(v)).map(v=>{const n=Date.parse(v);return [n,n+2*60*60*1000] as const;}).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b));}
export function detectScheduleConflicts(candidate:WeeklyCandidate,classes:WeeklyCandidate[],sharedEnrollments:string[]=[]):Conflict[]{
 const clashes:Conflict[]=[];
 for(const other of classes){
  if(candidate.id===other.id||candidate.academic_year!==other.academic_year)continue;
  const sameLecturer=candidate.lecturer_identity_number===other.lecturer_identity_number;
  const sameCohort=candidate.class_code===other.class_code;
  const sameRoom=candidate.room_name.trim().toLowerCase()===other.room_name.trim().toLowerCase();
  const sameStudent=sharedEnrollments.includes([candidate.id,other.id].sort().join(":"));
  const sameSlot=candidate.schedule_day===other.schedule_day&&timeMinutes(candidate.start_time)<timeMinutes(other.end_time)&&timeMinutes(other.start_time)<timeMinutes(candidate.end_time);
  if(sameSlot){
   if(sameRoom)clashes.push({otherId:other.id,otherClass:other.class_code,kind:"ROOM",detail:`Ruangan ${other.room_name} dipakai kelas ${other.class_code}`});
   if(sameLecturer)clashes.push({otherId:other.id,otherClass:other.class_code,kind:"LECTURER",detail:`Dosen sedang mengajar ${other.class_code}`});
   if(sameCohort)clashes.push({otherId:other.id,otherClass:other.class_code,kind:"COHORT",detail:`Mahasiswa ${other.class_code} memiliki kuliah bersamaan`});
   if(sameStudent&&!sameCohort)clashes.push({otherId:other.id,otherClass:other.class_code,kind:"ENROLLMENT",detail:`Peserta KRS yang sama terjadwal di ${other.class_code}`});
  }
  if(sameLecturer||sameCohort||sameRoom||sameStudent){
   for(const [start,end] of examRanges(candidate))for(const [otherStart,otherEnd] of examRanges(other)){
    if(start<otherEnd&&otherStart<end){clashes.push({otherId:other.id,otherClass:other.class_code,kind:"EXAM",detail:`UTS/UAS bertabrakan dengan ${other.class_code} (ruang, dosen, rombongan atau peserta KRS; durasi 120 menit)`});break;}
   }
  }
 }
 return clashes;
}
