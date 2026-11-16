import type {Metadata} from "next";import {sessionContext} from "@/lib/auth";import {readClasses} from "@/lib/data";import {SectionHead} from "@/components/UI";import {ClassList} from "@/components/ClassList";
export const metadata:Metadata={title:"Kelas Kuliah"};
export default async function ClassesPage(){const {db,profile}=await sessionContext();const all=await readClasses(db);const classes=profile.role==="dosen"?all.filter(c=>c.lecturer_identity_number===profile.identity_number):all;
 return <><SectionHead eyebrow="KATALOG PERKULIAHAN" title="Kelas Kuliah" subtitle={`Daftar mata kuliah semester 2026/2027 Ganjil · ${classes.length} kelas`}/><ClassList classes={classes}/></>;}
