-- Seed administratif berdasarkan PRD 2026/2027 Ganjil.
-- Kode course selain TIF-313 tidak diberikan PRD: kode NEX-002..008 adalah penanda internal, ganti dengan kode resmi jika sudah tersedia.
insert into public.lecturer_directory(identity_number,full_name) values
 ('0413088807','MUHAMAD IMAM'),('0431117105','DIAN NOVIANTI'),('0404067806','SUDIYANTO'),
 ('0405118304','HARRY GUNAWAN'),('7157750651130113','GUNADI DWI HANTORO'),
 ('0043761662131163','MASDUM MUSTAQWA'),('0402087307','FREDDY WICAKSONO')
on conflict(identity_number) do update set full_name=excluded.full_name;
insert into public.courses(course_code,name_id,name_en,sks_total,passing_grade_target) values
 ('TIF-313','Interaksi Manusia & Komputer','Human-Computer Interaction',3,2.75),
 ('NEX-002','Analisis dan Design PL',null,3,2.75),
 ('NEX-003','Pemrograman Berbasis Platform',null,3,2.75),
 ('NEX-004','Tata Tulis Ilmiah (Metodologi Penelitian)',null,2,2.75),
 ('NEX-005','Manajemen Proyek Teknologi Informasi',null,3,0.00),
 ('NEX-006','AIK 4 (Islam dan Ilmu Pengetahuan)',null,2,3.00),
 ('NEX-007','AI Computing Platform',null,3,2.00),
 ('NEX-008','Teknologi AR/VR',null,3,2.75)
on conflict(course_code) do update set name_id=excluded.name_id,sks_total=excluded.sks_total,passing_grade_target=excluded.passing_grade_target;
with inputs(course_code,class_code,nidn,dayname,tm_begin,tm_end,room,targets,students,completed,validated) as (
 values
 ('TIF-313','TI25D','0413088807','Senin','10:30'::time,'13:00'::time,'G. Mahdar R. D 403',16,30,2,true),
 ('NEX-002','TI24D','0431117105','Senin','13:00'::time,'15:30'::time,'G. Mahdar R. D 406',16,30,3,true),
 ('NEX-003','TI24D','0404067806','Senin','10:00'::time,'12:30'::time,'G. Mahdar R. D 406',16,30,3,true),
 ('NEX-004','TI24D','0405118304','Selasa','07:30'::time,'09:10'::time,'G. Mahdar R. D 405',7,30,2,true),
 ('NEX-005','TI24D','7157750651130113','Senin','07:30'::time,'10:00'::time,'G. Mahdar R. D 406',16,30,0,false),
 ('NEX-006','TI24D','0043761662131163','Kamis','10:00'::time,'11:40'::time,'G. Mahdar R. D 405',16,26,3,true),
 ('NEX-007','24K2B','0402087307','Rabu','19:00'::time,'22:00'::time,'G. Mahdar R. C 303',16,11,2,true),
 ('NEX-008','24K2B','0413088807','Selasa','13:00'::time,'15:30'::time,'G. Mahdar R. D 405',16,31,2,true)
)
insert into public.classes(academic_year,course_id,class_code,lecturer_identity_number,schedule_day,start_time,end_time,room_name,rps_target_meetings,initial_student_count,initial_meeting_count,rps_submitted,rps_validated_kaprodi,rps_validated_dekan)
select '2026/2027 Ganjil',c.id,i.class_code,i.nidn,i.dayname,i.tm_begin,i.tm_end,i.room,i.targets,i.students,i.completed,i.validated,i.validated,i.validated from inputs i join public.courses c on c.course_code=i.course_code
on conflict(academic_year,course_id,class_code) do nothing;

-- CPL/CPMK/Sub-CPMK TIF-313: persis bobot dan materi dari PRD.
with cr as(select id from public.courses where course_code='TIF-313')
insert into public.rps_cpl(course_id,code,description,weight)
select cr.id,i.code,i.description,i.weight from cr cross join(values
 ('CPL04','Mampu merancang, mengembangkan, dan mengimplementasikan sistem perangkat lunak dan infrastruktur TI yang andal, aman, dan skalabel.',38),
 ('CPL08','Mampu berkomunikasi secara efektif dalam bahasa Indonesia dan bahasa asing, serta berkolaborasi lintas disiplin.',62)
)i(code,description,weight)
on conflict(course_id,code) do nothing;
with cr as(select id from public.courses where course_code='TIF-313')
insert into public.rps_cpmk(course_id,cpl_id,code,description,weight)
select cr.id,cp.id,i.code,i.description,i.weight from cr cross join(values
 ('CPL04','CPMK 1','Mampu menganalisis prinsip IMK, faktor manusia, serta merancang arsitektur antarmuka pengguna (UI/UX) yang andal, aman, skalabel, dan ramah pengguna (User-Centered Design).',38),
 ('CPL08','CPMK 2','Mampu membangun prototipe interaktif, melakukan pengujian keusabilitas (Usability Testing), serta mempresentasikan dan mendokumentasikan hasil rancangan antarmuka secara efektif dalam tim kolaboratif.',62)
)i(cpl_code,code,description,weight) join public.rps_cpl cp on cp.course_id=cr.id and cp.code=i.cpl_code
on conflict(course_id,code) do nothing;
with cr as(select id from public.courses where course_code='TIF-313')
insert into public.rps_sub_cpmk(course_id,cpmk_id,code,description,weight,weight_uts,weight_uas,weight_a,weight_b,weight_c)
select cr.id,cm.id,i.code,i.description,i.weight,i.uts,i.uas,i.a,i.b,i.c from cr cross join(values
 ('CPMK 1','Sub-CPMK 1','Konsep dasar IMK, faktor manusia, ragam dialog, prinsip usability',11,8,0,3,0,0),
 ('CPMK 1','Sub-CPMK 2','Metodologi UCD / Design Thinking, User Persona, Customer Journey Map',19,12,0,3,0,4),
 ('CPMK 1','Sub-CPMK 3','Information Architecture, Design System, Low-Fidelity Wireframe',8,0,0,3,5,0),
 ('CPMK 2','Sub-CPMK 4','High-Fidelity Interactive Prototype',19,0,0,0,15,4),
 ('CPMK 2','Sub-CPMK 5','Usability Testing / Heuristic Evaluation & pengolahan data',25,0,10,3,5,7),
 ('CPMK 2','Sub-CPMK 6','Dokumen spesifikasi desain & presentasi kolaboratif',18,0,10,3,5,0)
)i(cpmk_code,code,description,weight,uts,uas,a,b,c) join public.rps_cpmk cm on cm.course_id=cr.id and cm.code=i.cpmk_code
on conflict(course_id,code) do nothing;
