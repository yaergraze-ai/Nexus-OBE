"use client";
import {useEffect,useMemo,useState} from "react";
import type {AcademicClass,Day} from "@/types/domain";
const days:Day[]=["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
const english:Record<string,Day>={Monday:"Senin",Tuesday:"Selasa",Wednesday:"Rabu",Thursday:"Kamis",Friday:"Jumat",Saturday:"Sabtu",Sunday:"Minggu"};
export function NextClassCountdown({classes}:{classes:AcademicClass[]}){
 const [now,setNow]=useState<Date|null>(null);useEffect(()=>{setNow(new Date());const id=setInterval(()=>setNow(new Date()),1000);return ()=>clearInterval(id);},[]);
 const next=useMemo(()=>{
  if(!now||!classes.length)return null;
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",weekday:"long",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const get=(key:string)=>parts.find(p=>p.type===key)?.value||"0";
  const today=days.indexOf(english[get("weekday")]);const minute=Number(get("hour"))*60+Number(get("minute"))+Number(get("second"))/60;
  const times=classes.map(c=>{const gapDays=(days.indexOf(c.schedule_day)-today+7)%7;let minutes=gapDays*1440+Number(c.start_time.slice(0,2))*60+Number(c.start_time.slice(3,5))-minute;if(minutes<0)minutes+=10080;return {course:c,minutes};});
  return times.sort((a,b)=>a.minutes-b.minutes)[0];
 },[now,classes]);
 if(!next)return <span className="tiny subtle">Belum ada jadwal berikutnya</span>;
 const seconds=Math.max(0,Math.ceil(next.minutes*60));const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),secs=seconds%60;
 return <span style={{display:"inline-flex",gap:8,alignItems:"center",fontSize:12}}><i className="bi bi-clock-history"/><strong>Kelas berikutnya:</strong> {next.course.courses.name_id} · <strong>{hours}j {minutes}m {secs}d</strong></span>;
}
