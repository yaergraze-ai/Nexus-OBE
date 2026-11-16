import type {AcademicClass,Profile,Role,RpsCpl,RpsCpmk,RpsSub} from "@/types/domain";
const owner:[string,string][]=[
 ["0413088807","MUHAMAD IMAM"],["0421117105","DIAN NOVIANTI"],["0404067806","SUDIYANTO"],["0405118304","HARRY GUNAWAN"],
 ["7157750651130113","GUNADI DWI HANTORO"],["0043761662131163","MASDUM MUSTAQWA"],["0402087307","FREDDY WICAKSONO"]
];
const tuples:[string,string,string,string,string,number,number,string,string,string,string,number,number,number,boolean,number][]=[
 ["TIF-313","Interaksi Manusia & Komputer","Human-Computer Interaction","TI25D","0413088807",3,2.75,"Senin","10:30","13:00","G. Mahdar R. D 403",16,30,2,true,0],
 ["NEX-002","Analisis dan Design PL","","TI24D","0421117105",3,2.75,"Senin","13:00","15:30","G. Mahdar R. D 406",16,30,3,true,0],
 ["NEX-003","Pemrograman Berbasis Platform","","TI24D","0404067806",3,2.75,"Senin","10:00","12:30","G. Mahdar R. D 406",16,30,3,true,0],
 ["NEX-004","Tata Tulis Ilmiah (Metodologi Penelitian)","","TI24D","0405118304",2,2.75,"Selasa","07:30","09:10","G. Mahdar R. D 405",7,30,2,true,0],
 ["NEX-005","Manajemen Proyek Teknologi Informasi","","TI24D","7157750651130113",3,0,"Senin","07:30","10:00","G. Mahdar R. D 406",16,30,0,false,0],
 ["NEX-006","AIK 4 (Islam dan Ilmu Pengetahuan)","","TI24D","0043761662131163",2,3,"Kamis","10:00","11:40","G. Mahdar R. D 405",16,26,3,true,0],
 ["NEX-007","AI Computing Platform","","24K2B","0402087307",3,2,"Rabu","19:00","22:00","G. Mahdar R. C 303",16,11,2,true,0],
 ["NEX-008","Teknologi AR/VR","","24K2B","0413088807",3,2.75,"Selasa","13:00","15:30","G. Mahdar R. D 405",16,31,2,true,0]
];
export const demoClasses:AcademicClass[]=tuples.map((row,index)=>({
 id:`demo-class-${index+1}`,course_id:`demo-course-${index+1}`,academic_year:"2026/2027 Ganjil",
 class_code:row[3],lecturer_identity_number:row[4],schedule_day:row[7] as AcademicClass["schedule_day"],start_time:row[8],end_time:row[9],room_name:row[10],
 uts_schedule:null,uas_schedule:null,pbm_period:"on",rps_submitted:row[14],rps_validated_kaprodi:row[14],rps_validated_dekan:row[14],
 rps_target_meetings:row[11],initial_student_count:row[12],initial_meeting_count:row[13],weight_attendance:10,weight_uts:20,weight_uas:20,weight_daily_task:20,weight_group_task:20,weight_major_project:10,
 courses:{id:`demo-course-${index+1}`,course_code:row[0],name_id:row[1],name_en:row[2]||null,sks_total:row[5],passing_grade_target:row[6]},
 lecturer_directory:{identity_number:row[4],full_name:owner.find(o=>o[0]===row[4])?.[1]||"Dosen"}
}));
export const demoProfiles:Record<Role,Profile>={
 mahasiswa:{id:"demo-student",full_name:"KANA NURHANA",identity_number:"240511088",email:"demo-mahasiswa@example.edu",role:"mahasiswa",faculty:"FAKULTAS TEKNIK",study_program:"Teknik Informatika",is_active:true},
 dosen:{id:"demo-lecturer",full_name:"MUHAMAD IMAM",identity_number:"0413088807",email:"demo-dosen@example.edu",role:"dosen",faculty:"FAKULTAS TEKNIK",study_program:"Teknik Informatika",is_active:true},
 admin:{id:"demo-admin",full_name:"ADMIN AKADEMIK",identity_number:"ADMIN-001",email:"demo-admin@example.edu",role:"admin",faculty:"FAKULTAS TEKNIK",study_program:"Teknik Informatika",is_active:true},
 super_admin:{id:"demo-super",full_name:"SUPER ADMIN",identity_number:"SYS-001",email:"demo-super@example.edu",role:"super_admin",faculty:"FAKULTAS TEKNIK",study_program:"Teknik Informatika",is_active:true}
};
export const demoCpl:RpsCpl[]=[
 {id:"cpl04",course_id:"demo-course-1",code:"CPL04",description:"Mampu merancang, mengembangkan, dan mengimplementasikan sistem perangkat lunak dan infrastruktur TI yang andal, aman, dan skalabel.",weight:38},
 {id:"cpl08",course_id:"demo-course-1",code:"CPL08",description:"Mampu berkomunikasi secara efektif dalam bahasa Indonesia dan bahasa asing, serta berkolaborasi lintas disiplin.",weight:62}
];
export const demoCpmk:RpsCpmk[]=[
 {id:"cpmk1",course_id:"demo-course-1",cpl_id:"cpl04",code:"CPMK 1",description:"Menganalisis prinsip IMK, faktor manusia, serta merancang arsitektur UI/UX dengan User-Centered Design.",weight:38},
 {id:"cpmk2",course_id:"demo-course-1",cpl_id:"cpl08",code:"CPMK 2",description:"Membangun prototipe interaktif, menguji keusabilitas, dan mempresentasikan hasil rancangan secara kolaboratif.",weight:62}
];
const sub:[string,string,string,number,number,number,number,number,number][]=[
 ["cpmk1","Sub-CPMK 1","Konsep dasar IMK, faktor manusia, ragam dialog, prinsip usability",11,8,0,3,0,0],
 ["cpmk1","Sub-CPMK 2","Metodologi UCD / Design Thinking, User Persona, Customer Journey Map",19,12,0,3,0,4],
 ["cpmk1","Sub-CPMK 3","Information Architecture, Design System, Low-Fidelity Wireframe",8,0,0,3,5,0],
 ["cpmk2","Sub-CPMK 4","High-Fidelity Interactive Prototype",19,0,0,0,15,4],
 ["cpmk2","Sub-CPMK 5","Usability Testing / Heuristic Evaluation & pengolahan data",25,0,10,3,5,7],
 ["cpmk2","Sub-CPMK 6","Dokumen spesifikasi desain & presentasi kolaboratif",18,0,10,3,5,0]
];
export const demoSub:RpsSub[]=sub.map((s,i)=>({id:`s${i+1}`,course_id:"demo-course-1",cpmk_id:s[0],code:s[1],description:s[2],weight:s[3],weight_uts:s[4],weight_uas:s[5],weight_a:s[6],weight_b:s[7],weight_c:s[8]}));
