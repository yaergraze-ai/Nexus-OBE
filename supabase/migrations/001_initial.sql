-- NEXUS OBE v2.0. Jalankan pada Supabase SQL Editor sebelum seed.
create extension if not exists pgcrypto;
do $$ begin create type public.user_role as enum ('mahasiswa','dosen','admin','super_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.meeting_type as enum ('KULIAH','PRAKTIKUM','UTS','UAS','PENGGANTI'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attendance_status as enum ('HADIR','IZIN','SAKIT','ALPHA'); exception when duplicate_object then null; end $$;
do $$ begin create type public.session_state as enum ('LIVE','COMPLETED_LOCKED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.pbm_status as enum ('on','off'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 identity_number varchar(30) unique not null,
 full_name varchar(150) not null,
 email varchar(150) unique not null,
 role public.user_role not null default 'mahasiswa',
 faculty varchar(100) default 'FAKULTAS TEKNIK',
 study_program varchar(100) default 'Teknik Informatika',
 avatar_url text,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.lecturer_directory (
 identity_number varchar(30) primary key, full_name varchar(150) not null
);
create table if not exists public.courses (
 id uuid primary key default gen_random_uuid(),course_code varchar(20) unique not null,
 name_id varchar(150) not null,name_en varchar(150),
 sks_total numeric(3,1) not null default 3.0 check(sks_total>0),
 passing_grade_target numeric(3,2) not null default 2.75 check(passing_grade_target between 0 and 4),
 created_at timestamptz not null default now()
);
create table if not exists public.classes (
 id uuid primary key default gen_random_uuid(),academic_year varchar(30) not null default '2026/2027 Ganjil',
 course_id uuid not null references public.courses(id) on delete restrict,
 lecturer_identity_number varchar(30) not null references public.lecturer_directory(identity_number),
 class_code varchar(20) not null,schedule_day varchar(15) not null check(schedule_day in ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
 start_time time not null,end_time time not null,room_name varchar(100) not null,
 uts_schedule timestamptz,uas_schedule timestamptz,
 pbm_period public.pbm_status not null default 'on',rps_submitted boolean not null default false,
 rps_validated_kaprodi boolean not null default false,rps_validated_dekan boolean not null default false,
 rps_target_meetings integer not null default 16 check(rps_target_meetings between 1 and 40),
 initial_meeting_count integer not null default 0, initial_student_count integer not null default 0,
 weight_attendance int not null default 10, weight_uts int not null default 20,weight_uas int not null default 20,
 weight_daily_task int not null default 20,weight_group_task int not null default 20,weight_major_project int not null default 10,
 created_at timestamptz not null default now(),
 constraint class_weight_100 check(weight_attendance+weight_uts+weight_uas+weight_daily_task+weight_group_task+weight_major_project=100),
 constraint class_time_order check (start_time < end_time),
 constraint class_unique unique(academic_year,course_id,class_code)
);
create table if not exists public.class_enrollments (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,enrolled_at timestamptz not null default now(),
 unique(class_id,student_id)
);
create table if not exists public.meetings (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes(id) on delete cascade,
 meeting_number int not null check(meeting_number>0),meeting_date date not null,type public.meeting_type not null default 'KULIAH',
 summary text not null check(length(summary) between 10 and 2000),documentation_photo_path text not null,
 status public.session_state not null default 'LIVE',starts_at timestamptz not null,ends_at timestamptz not null,
 override_expires_at timestamptz,unlocked_by_admin_id uuid references public.profiles(id),
 created_at timestamptz not null default now(),unique(class_id,meeting_number),check(ends_at>starts_at)
);
create unique index if not exists meetings_one_live_per_class on public.meetings(class_id) where status='LIVE';
create table if not exists public.attendances (
 id uuid primary key default gen_random_uuid(),meeting_id uuid not null references public.meetings(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 status public.attendance_status not null default 'HADIR',checked_in_at timestamptz not null default now(),unique(meeting_id,student_id)
);
create table if not exists public.rps_cpl (
 id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses(id) on delete cascade,
 code varchar(15) not null,description text not null,weight integer not null check(weight between 0 and 100),unique(course_id,code)
);
create table if not exists public.rps_cpmk (
 id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses(id) on delete cascade,
 cpl_id uuid not null references public.rps_cpl(id) on delete cascade,code varchar(15) not null,
 description text not null,weight integer not null check(weight between 0 and 100),unique(course_id,code)
);
create table if not exists public.rps_sub_cpmk (
 id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses(id) on delete cascade,
 cpmk_id uuid not null references public.rps_cpmk(id) on delete cascade,code varchar(20) not null,
 description text not null,weight int not null check(weight between 0 and 100),
 weight_uts int not null default 0,weight_uas int not null default 0,weight_a int not null default 0,
 weight_b int not null default 0,weight_c int not null default 0,
 constraint sub_matrix_total check(weight=weight_uts+weight_uas+weight_a+weight_b+weight_c),unique(course_id,code)
);
create table if not exists public.grades (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 score_attendance numeric(5,2) not null default 0 check(score_attendance between 0 and 100),
 score_uts numeric(5,2) not null default 0 check(score_uts between 0 and 100),
 score_uas numeric(5,2) not null default 0 check(score_uas between 0 and 100),
 score_daily_task numeric(5,2) not null default 0 check(score_daily_task between 0 and 100),
 score_group_task numeric(5,2) not null default 0 check(score_group_task between 0 and 100),
 score_major_project numeric(5,2) not null default 0 check(score_major_project between 0 and 100),
 updated_at timestamptz not null default now(),unique(class_id,student_id)
);
create or replace view public.vw_student_final_grades with (security_invoker=true) as
select v.class_id,v.student_id,v.grade_id,v.final_numeric_score,
 case when v.final_numeric_score>=85 then 'A' when v.final_numeric_score>=70 then 'B'
 when v.final_numeric_score>=55 then 'C' when v.final_numeric_score>=40 then 'D' else 'E' end as letter_grade,
 case when v.final_numeric_score>=85 then 4 when v.final_numeric_score>=70 then 3
 when v.final_numeric_score>=55 then 2 when v.final_numeric_score>=40 then 1 else 0 end as quality_point
from (select g.id grade_id,g.class_id,g.student_id,round(
   g.score_attendance*c.weight_attendance/100.0+g.score_uts*c.weight_uts/100.0+
   g.score_uas*c.weight_uas/100.0+g.score_daily_task*c.weight_daily_task/100.0+
   g.score_group_task*c.weight_group_task/100.0+g.score_major_project*c.weight_major_project/100.0,2
) final_numeric_score from public.grades g join public.classes c on c.id=g.class_id) v;
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 title varchar(150) not null,message text not null,category varchar(30) not null,action_url text,
 is_read boolean not null default false,created_at timestamptz not null default now()
);
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text unique not null,p256dh text not null,auth text not null,created_at timestamptz not null default now()
);
create table if not exists public.notification_dispatch_logs (
 idempotency_key varchar(200) primary key,dispatched_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id) on delete set null,
 action varchar(100) not null,target_table varchar(50) not null,target_id uuid,metadata jsonb,
 ip_address varchar(45),created_at timestamptz not null default now()
);

-- Auth UID comes from verified JWT, never from client-provided parameters.
create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=(select auth.uid()) and is_active=true limit 1;
$$;
create or replace function public.has_role(p_roles public.user_role[]) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.current_role()=any(p_roles),false) and (public.current_role()='mahasiswa' or coalesce(auth.jwt()->>'aal','')='aal2');
$$;
create or replace function public.teaches_class(p_class uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.classes c join public.profiles p on p.identity_number=c.lecturer_identity_number
 where c.id=p_class and p.id=(select auth.uid()) and p.role='dosen' and p.is_active and coalesce(auth.jwt()->>'aal','')='aal2');
$$;
create or replace function public.enrolled_in(p_class uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.class_enrollments where class_id=p_class and student_id=(select auth.uid()));
$$;
create or replace function public.can_read_class(p_class uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.has_role(array['admin','super_admin']::public.user_role[]) or public.teaches_class(p_class) or public.enrolled_in(p_class);
$$;
create or replace function public.log_event(p_action text,p_target_table text,p_target_id uuid,p_metadata jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path=public as $$ begin
 insert into public.audit_logs(actor_id,action,target_table,target_id,metadata) values(auth.uid(),left(p_action,100),left(p_target_table,50),p_target_id,p_metadata);
end $$;
create or replace function public.forbid_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'Audit log bersifat append-only';end $$;
drop trigger if exists audit_immutable on public.audit_logs;
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function public.forbid_audit_mutation();

-- Server-side business gates. RLS alone is not a replacement for transaction-bound checks.
create or replace function public.start_meeting(p_class_id uuid,p_type public.meeting_type,p_summary text,p_photo_path text)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype;v_id uuid;v_date date;v_day text;v_begin timestamptz;v_end timestamptz;v_number int;
begin
 if not public.teaches_class(p_class_id) then raise exception 'Hanya dosen pengampu yang dapat membuka pertemuan';end if;
 select * into c from public.classes where id=p_class_id for update;
 if not found then raise exception 'Kelas tidak tersedia';end if;
 if c.pbm_period<>'on' or not(c.rps_validated_kaprodi and c.rps_validated_dekan) then raise exception 'RPS belum tervalidasi atau periode PBM nonaktif';end if;
 if length(trim(p_summary)) not between 10 and 2000 then raise exception 'Ringkasan harus 10-2000 karakter';end if;
 if p_photo_path not like p_class_id::text||'/%' then raise exception 'Jalur dokumentasi tidak sesuai kelas';end if;
 v_date=(now() at time zone 'Asia/Jakarta')::date;
 v_day=(array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'])[extract(isodow from v_date)::int];
 if c.schedule_day<>v_day and p_type<>'PENGGANTI' then raise exception 'Hari ini bukan jadwal kelas. Gunakan pertemuan pengganti sesuai kebijakan.';end if;
 v_begin=(v_date+c.start_time) at time zone 'Asia/Jakarta';
 v_end=(v_date+c.end_time) at time zone 'Asia/Jakarta';
 if now()>=v_end then raise exception 'Jam perkuliahan sudah selesai';end if;
 if p_type<>'PENGGANTI' and now()<v_begin-interval '30 minutes' then raise exception 'Sesi hanya dapat dimulai paling awal 30 menit sebelum jadwal';end if;
 if exists(select 1 from public.meetings where class_id=p_class_id and status='LIVE') then raise exception 'Masih ada sesi aktif';end if;
 select coalesce(max(meeting_number),0)+1 into v_number from public.meetings where class_id=p_class_id;
 if v_number>c.rps_target_meetings then raise exception 'Target pertemuan sudah terpenuhi';end if;
 insert into public.meetings(class_id,meeting_number,meeting_date,type,summary,documentation_photo_path,status,starts_at,ends_at)
 values(p_class_id,v_number,v_date,p_type,trim(p_summary),p_photo_path,'LIVE',now(),v_end) returning id into v_id;
 perform public.log_event('MEETING_STARTED','meetings',v_id,jsonb_build_object('class_id',p_class_id,'number',v_number));
 return v_id;
end $$;
create or replace function public.finish_meeting(p_meeting_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_class uuid;begin
 select class_id into v_class from public.meetings where id=p_meeting_id for update;
 if v_class is null or not public.teaches_class(v_class) then raise exception 'Akses pertemuan ditolak';end if;
 update public.meetings set status='COMPLETED_LOCKED' where id=p_meeting_id and status='LIVE';
 perform public.log_event('MEETING_FINISHED','meetings',p_meeting_id);
end $$;
create or replace function public.check_in(p_meeting_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare m public.meetings%rowtype;begin
 if public.current_role()<>'mahasiswa' then raise exception 'Presensi hanya untuk mahasiswa';end if;
 select * into m from public.meetings where id=p_meeting_id for update;
 if not found or not public.enrolled_in(m.class_id) then raise exception 'Anda tidak terdaftar pada pertemuan ini';end if;
 if m.status<>'LIVE' or now()>=m.ends_at then raise exception 'Presensi telah ditutup';end if;
 insert into public.attendances(meeting_id,student_id,status) values(p_meeting_id,auth.uid(),'HADIR') on conflict(meeting_id,student_id) do nothing;
end $$;
create or replace function public.override_meeting(p_meeting_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']::public.user_role[]) then raise exception 'Hanya admin yang dapat membuka ulang BAP';end if;
 update public.meetings set override_expires_at=now()+interval '30 minutes',unlocked_by_admin_id=auth.uid()
 where id=p_meeting_id and status='COMPLETED_LOCKED';
 if not found then raise exception 'BAP tidak ditemukan atau belum terkunci';end if;
 perform public.log_event('BAP_OVERRIDE','meetings',p_meeting_id,jsonb_build_object('duration_minutes',30));
end $$;
create or replace function public.update_meeting_summary(p_meeting_id uuid,p_summary text) returns void language plpgsql security definer set search_path=public as $$
declare m public.meetings%rowtype;begin
 select * into m from public.meetings where id=p_meeting_id for update;
 if not found or not public.teaches_class(m.class_id) then raise exception 'Akses BAP ditolak';end if;
 if length(trim(p_summary)) not between 10 and 2000 then raise exception 'Ringkasan tidak valid';end if;
 if not (m.status='LIVE' and now()<m.ends_at) and not (m.override_expires_at is not null and now()<m.override_expires_at) then raise exception 'BAP sudah terkunci';end if;
 update public.meetings set summary=trim(p_summary) where id=p_meeting_id;
 perform public.log_event('BAP_UPDATED','meetings',p_meeting_id);
end $$;
create or replace function public.save_grade(p_class_id uuid,p_student_id uuid,p_scores jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare s numeric;v_key text;begin
 if not(public.teaches_class(p_class_id) or public.has_role(array['admin','super_admin']::public.user_role[])) then raise exception 'Akses pengisian nilai ditolak';end if;
 if not exists(select 1 from public.class_enrollments where class_id=p_class_id and student_id=p_student_id) then raise exception 'Mahasiswa tidak terdaftar pada kelas';end if;
 foreach v_key in array array['attendance','uts','uas','daily_task','group_task','major_project'] loop
  if not (p_scores ? v_key) or jsonb_typeof(p_scores->v_key)<>'number' then raise exception 'Nilai komponen tidak lengkap';end if;
  s=(p_scores->>v_key)::numeric;
  if s<0 or s>100 then raise exception 'Rentang nilai wajib 0-100';end if;
 end loop;
 insert into public.grades(class_id,student_id,score_attendance,score_uts,score_uas,score_daily_task,score_group_task,score_major_project)
 values(p_class_id,p_student_id,(p_scores->>'attendance')::numeric,(p_scores->>'uts')::numeric,(p_scores->>'uas')::numeric,
 (p_scores->>'daily_task')::numeric,(p_scores->>'group_task')::numeric,(p_scores->>'major_project')::numeric)
 on conflict(class_id,student_id) do update set score_attendance=excluded.score_attendance,score_uts=excluded.score_uts,score_uas=excluded.score_uas,
 score_daily_task=excluded.score_daily_task,score_group_task=excluded.score_group_task,score_major_project=excluded.score_major_project,updated_at=now();
 perform public.log_event('GRADE_UPDATED','grades',p_student_id,jsonb_build_object('class_id',p_class_id));
end $$;
create or replace function public.validate_rps(p_class_id uuid,p_authority text) returns void
language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype;begin
 if not public.has_role(array['admin','super_admin']::public.user_role[]) then raise exception 'Hanya admin yang boleh memvalidasi RPS';end if;
 if p_authority not in ('kaprodi','dekan') then raise exception 'Jenis validasi tidak dikenali';end if;
 select * into c from public.classes where id=p_class_id for update;
 if not found or not c.rps_submitted then raise exception 'RPS belum diajukan dosen';end if;
 if p_authority='kaprodi' then update public.classes set rps_validated_kaprodi=true where id=p_class_id;
 else update public.classes set rps_validated_dekan=true where id=p_class_id;end if;
 perform public.log_event('RPS_VALIDATED_'||upper(p_authority),'classes',p_class_id);
end $$;
create or replace function public.submit_rps(p_class_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype;v_total int;begin
 select * into c from public.classes where id=p_class_id for update;
 if not found or not public.teaches_class(p_class_id) then raise exception 'Hanya dosen pengampu dapat mengajukan RPS';end if;
 select coalesce(sum(weight),0) into v_total from public.rps_cpl where course_id=c.course_id;
 if v_total<>100 then raise exception 'Bobot CPL harus 100%%';end if;
 select coalesce(sum(weight),0) into v_total from public.rps_cpmk where course_id=c.course_id;
 if v_total<>100 then raise exception 'Bobot CPMK harus 100%%';end if;
 select coalesce(sum(weight),0) into v_total from public.rps_sub_cpmk where course_id=c.course_id;
 if v_total<>100 then raise exception 'Bobot Sub-CPMK harus 100%%';end if;
 if exists(select 1 from public.rps_cpl a where a.course_id=c.course_id and a.weight<>(select coalesce(sum(b.weight),0) from public.rps_cpmk b where b.cpl_id=a.id))
 or exists(select 1 from public.rps_cpmk a where a.course_id=c.course_id and a.weight<>(select coalesce(sum(b.weight),0) from public.rps_sub_cpmk b where b.cpmk_id=a.id)) then raise exception 'Pemetaan bobot antar jenjang RPS tidak konsisten';end if;
 update public.classes set rps_submitted=true,rps_validated_kaprodi=false,rps_validated_dekan=false where id=p_class_id;
 perform public.log_event('RPS_SUBMITTED','classes',p_class_id);
end $$;
create or replace function public.replace_rps(p_class_id uuid,p_structure jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype;v_cpl jsonb;v_cpmk jsonb;v_sub jsonb;v_cpl_id uuid;v_cpmk_id uuid;
 sum_cpl int:=0;sum_cpmk int:=0;sum_sub int:=0;local_cpmk int;local_sub int;v_weight int;
begin
 select * into c from public.classes where id=p_class_id for update;
 if not found or not public.teaches_class(p_class_id) then raise exception 'Akses edit RPS ditolak';end if;
 if exists(select 1 from public.meetings m join public.classes x on x.id=m.class_id where x.course_id=c.course_id and m.status='LIVE') then raise exception 'Selesaikan sesi aktif sebelum mengubah RPS';end if;
 if jsonb_typeof(p_structure)<>'array' or jsonb_array_length(p_structure) not between 1 and 20 then raise exception 'Struktur RPS tidak valid';end if;
 delete from public.rps_cpl where course_id=c.course_id;
 for v_cpl in select value from jsonb_array_elements(p_structure) loop
  v_weight=(v_cpl->>'weight')::int;sum_cpl=sum_cpl+v_weight;local_cpmk:=0;
  insert into public.rps_cpl(course_id,code,description,weight) values(c.course_id,v_cpl->>'code',v_cpl->>'description',v_weight) returning id into v_cpl_id;
  for v_cpmk in select value from jsonb_array_elements(v_cpl->'cpmks') loop
   v_weight=(v_cpmk->>'weight')::int;sum_cpmk=sum_cpmk+v_weight;local_cpmk=local_cpmk+v_weight;local_sub:=0;
   insert into public.rps_cpmk(course_id,cpl_id,code,description,weight)values(c.course_id,v_cpl_id,v_cpmk->>'code',v_cpmk->>'description',v_weight)returning id into v_cpmk_id;
   for v_sub in select value from jsonb_array_elements(v_cpmk->'subs') loop
    v_weight=(v_sub->>'weight')::int;sum_sub=sum_sub+v_weight;local_sub=local_sub+v_weight;
    if v_weight<>(v_sub->>'weight_uts')::int+(v_sub->>'weight_uas')::int+(v_sub->>'weight_a')::int+(v_sub->>'weight_b')::int+(v_sub->>'weight_c')::int then raise exception 'Matriks bobot tidak konsisten';end if;
    insert into public.rps_sub_cpmk(course_id,cpmk_id,code,description,weight,weight_uts,weight_uas,weight_a,weight_b,weight_c)
    values(c.course_id,v_cpmk_id,v_sub->>'code',v_sub->>'description',v_weight,(v_sub->>'weight_uts')::int,(v_sub->>'weight_uas')::int,(v_sub->>'weight_a')::int,(v_sub->>'weight_b')::int,(v_sub->>'weight_c')::int);
   end loop;
   if local_sub<>(v_cpmk->>'weight')::int then raise exception 'Jumlah Sub-CPMK tidak sesuai CPMK';end if;
  end loop;
  if local_cpmk<>(v_cpl->>'weight')::int then raise exception 'Jumlah CPMK tidak sesuai CPL';end if;
 end loop;
 if sum_cpl<>100 or sum_cpmk<>100 or sum_sub<>100 then raise exception 'Bobot RPS pada semua jenjang wajib 100%%';end if;
 update public.classes set rps_submitted=false,rps_validated_kaprodi=false,rps_validated_dekan=false where course_id=c.course_id;
 perform public.log_event('RPS_REPLACED','classes',p_class_id,jsonb_build_object('course_id',c.course_id));
end $$;
create or replace function public.update_class_schedule(p_class_id uuid,p_day text,p_start time,p_end time,p_room text,p_uts timestamptz,p_uas timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype;begin
 if not public.has_role(array['admin','super_admin']::public.user_role[]) then raise exception 'Hanya admin boleh memperbarui jadwal';end if;
 select * into c from public.classes where id=p_class_id for update;
 if not found or p_start>=p_end or p_day not in ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu') or length(trim(p_room)) not between 3 and 100 then raise exception 'Data jadwal tidak valid';end if;
 if exists(select 1 from public.meetings m where m.class_id=p_class_id and m.status='LIVE') then raise exception 'Tutup pertemuan LIVE sebelum mengganti jadwal';end if;
 if exists(select 1 from public.classes other where other.id<>p_class_id and other.academic_year=c.academic_year and other.schedule_day=p_day
 and other.start_time<p_end and other.end_time>p_start and (other.room_name=p_room or other.lecturer_identity_number=c.lecturer_identity_number)) then raise exception 'Bentrok ruang atau jadwal dosen';end if;
 update public.classes set schedule_day=p_day,start_time=p_start,end_time=p_end,room_name=trim(p_room),uts_schedule=p_uts,uas_schedule=p_uas where id=p_class_id;
 perform public.log_event('SCHEDULE_UPDATED','classes',p_class_id);
end $$;
create or replace function public.update_pbm(p_class_id uuid,p_state public.pbm_status) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']::public.user_role[]) then raise exception 'Akses ditolak';end if;
 update public.classes set pbm_period=p_state where id=p_class_id;
 if not found then raise exception 'Kelas tidak ditemukan';end if;
 perform public.log_event('PBM_UPDATED','classes',p_class_id,jsonb_build_object('state',p_state));
end $$;
create or replace function public.change_user_role(p_user_id uuid,p_role public.user_role) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_role(array['super_admin']::public.user_role[]) then raise exception 'Khusus super admin';end if;
 if p_user_id=auth.uid() then raise exception 'Tidak dapat mengubah role diri sendiri';end if;
 update public.profiles set role=p_role,updated_at=now() where id=p_user_id;
 if not found then raise exception 'Akun tidak ditemukan';end if;
 perform public.log_event('ROLE_UPDATED','profiles',p_user_id,jsonb_build_object('new_role',p_role));
end $$;
create or replace function public.mark_notification_read(p_notification_id uuid) returns void language plpgsql security invoker set search_path=public as $$
begin update public.notifications set is_read=true where id=p_notification_id and user_id=auth.uid();end $$;
create or replace function public.close_expired_meetings() returns integer language plpgsql security definer set search_path=public as $$
declare n int;begin
 if auth.role()<>'service_role' then raise exception 'Khusus cron server';end if;
 update public.meetings set status='COMPLETED_LOCKED' where status='LIVE' and ends_at<=now();get diagnostics n=row_count;return n;
end $$;

-- Activate RLS on EVERY public table, including lookup tables and dispatch logs.
alter table public.profiles enable row level security;
alter table public.lecturer_directory enable row level security;
alter table public.courses enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.meetings enable row level security;
alter table public.attendances enable row level security;
alter table public.rps_cpl enable row level security;
alter table public.rps_cpmk enable row level security;
alter table public.rps_sub_cpmk enable row level security;
alter table public.grades enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_dispatch_logs enable row level security;
alter table public.audit_logs enable row level security;

create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.has_role(array['admin','super_admin']::public.user_role[]) or (public.current_role()='dosen' and exists(select 1 from public.class_enrollments e where e.student_id=profiles.id and public.teaches_class(e.class_id))));
create policy lecturer_list on public.lecturer_directory for select to authenticated using(true);
create policy course_list on public.courses for select to authenticated using(true);
create policy class_list on public.classes for select to authenticated using(true);
create policy enrollment_read on public.class_enrollments for select to authenticated using(student_id=auth.uid() or public.teaches_class(class_id) or public.has_role(array['admin','super_admin']::public.user_role[]));
create policy meeting_read on public.meetings for select to authenticated using(public.can_read_class(class_id));
create policy attendance_read on public.attendances for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.meetings m where m.id=meeting_id and (public.teaches_class(m.class_id) or public.has_role(array['admin','super_admin']::public.user_role[]))));
create policy cpl_read on public.rps_cpl for select to authenticated using(true);
create policy cpmk_read on public.rps_cpmk for select to authenticated using(true);
create policy sub_read on public.rps_sub_cpmk for select to authenticated using(true);
create policy grades_read on public.grades for select to authenticated using(student_id=auth.uid() or public.teaches_class(class_id) or public.has_role(array['admin','super_admin']::public.user_role[]));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy subscriptions_read on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy subscriptions_insert on public.push_subscriptions for insert to authenticated with check(user_id=auth.uid());
create policy subscriptions_update on public.push_subscriptions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy subscriptions_delete on public.push_subscriptions for delete to authenticated using(user_id=auth.uid());
create policy audit_super_read on public.audit_logs for select to authenticated using(public.has_role(array['super_admin']::public.user_role[]));

-- No direct insert/update for protected tables; mutations use authenticated SECURITY DEFINER RPCs.
revoke all on function public.close_expired_meetings() from public,anon,authenticated;
grant execute on function public.close_expired_meetings() to service_role;
revoke all on function public.log_event(text,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.current_role() from anon;
revoke all on function public.has_role(public.user_role[]) from anon;
revoke all on function public.teaches_class(uuid) from anon;
revoke all on function public.enrolled_in(uuid) from anon;
revoke all on function public.can_read_class(uuid) from anon;

-- Documentation bucket is private; authenticated lecturers may upload only to their class prefix.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bap-documents','bap-documents',false,500000,array['image/webp']) on conflict (id) do nothing;
create policy bap_read on storage.objects for select to authenticated using(
 bucket_id='bap-documents' and case when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.can_read_class(split_part(name,'/',1)::uuid) else false end
);
create policy bap_upload on storage.objects for insert to authenticated with check(
 bucket_id='bap-documents' and case when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.teaches_class(split_part(name,'/',1)::uuid) else false end
);
create policy bap_delete on storage.objects for delete to authenticated using(
 bucket_id='bap-documents' and case when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.teaches_class(split_part(name,'/',1)::uuid) else false end
);

-- Realtime respects RLS on both tables.
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null;end $$;
do $$ begin alter publication supabase_realtime add table public.meetings; exception when duplicate_object then null;end $$;

-- Harden notification mutation: only is_read is writable by the owner.
revoke update on public.notifications from authenticated;
grant update(is_read) on public.notifications to authenticated;

-- Persistent, database-backed login throttling (service-role only).
create table if not exists public.login_throttles (
 bucket_hash text primary key,attempts int not null default 0,window_started timestamptz not null default now()
);
alter table public.login_throttles enable row level security;
create or replace function public.consume_login_attempt(p_hash text) returns boolean
language plpgsql security definer set search_path=public as $$
declare n int;begin
 if auth.role()<>'service_role' then raise exception 'Unauthorized';end if;
 if length(p_hash)<>64 then raise exception 'Bucket hash invalid';end if;
 perform pg_advisory_xact_lock(hashtext(p_hash));
 insert into public.login_throttles(bucket_hash,attempts,window_started) values(p_hash,1,now())
 on conflict(bucket_hash) do update set attempts=case when public.login_throttles.window_started<now()-interval '15 minutes' then 1 else public.login_throttles.attempts+1 end,
 window_started=case when public.login_throttles.window_started<now()-interval '15 minutes' then now() else public.login_throttles.window_started end;
 select attempts into n from public.login_throttles where bucket_hash=p_hash;
 return n<=5;
end $$;
create or replace function public.clear_login_attempts(p_hash text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.role()<>'service_role' then raise exception 'Unauthorized';end if;
 delete from public.login_throttles where bucket_hash=p_hash;
end $$;
revoke all on function public.consume_login_attempt(text) from public,anon,authenticated;
revoke all on function public.clear_login_attempts(text) from public,anon,authenticated;
grant execute on function public.consume_login_attempt(text) to service_role;
grant execute on function public.clear_login_attempts(text) to service_role;
-- Enrollment is managed only by Admin; users cannot enroll themselves.
create policy enrollment_admin_insert on public.class_enrollments for insert to authenticated
with check(public.has_role(array['admin','super_admin']::public.user_role[])
 and exists(select 1 from public.profiles p where p.id=student_id and p.role='mahasiswa' and p.is_active));
