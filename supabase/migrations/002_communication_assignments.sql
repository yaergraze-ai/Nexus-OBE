-- NEXUS OBE v2.1: announcements, coursework, submission revisions, and clash-safe scheduling.
-- Apply AFTER 001_initial.sql. Production: test on staging before applying to a live database.
begin;
create table public.announcements (
 id uuid primary key default gen_random_uuid(),
 class_id uuid references public.classes(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 audience text not null check (audience in ('all','mahasiswa','dosen','admin','super_admin')),
 title varchar(150) not null check (char_length(trim(title)) between 5 and 150),
 body text not null check (char_length(trim(body)) between 10 and 4000),
 pinned boolean not null default false,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 check (expires_at is null or expires_at>created_at)
);
create index announcements_class_date on public.announcements(class_id,created_at desc);

create table public.assignments (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 title varchar(150) not null check(char_length(trim(title)) between 5 and 150),
 description text not null check(char_length(trim(description)) between 10 and 6000),
 component text not null check(component in ('daily_task','group_task','major_project')),
 resource_links jsonb not null default '[]'::jsonb check (jsonb_typeof(resource_links)='array'),
 due_at timestamptz not null,
 accept_late boolean not null default false,
 published boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index assignments_class_due on public.assignments(class_id,due_at);

create table public.assignment_files (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 storage_path text not null unique,
 file_name varchar(160) not null,
 content_type varchar(120) not null,
 byte_size integer not null check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now()
);
create table public.assignment_submissions (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 student_id uuid not null references public.profiles(id),
 content text not null default '' check(char_length(content)<=10000),
 links jsonb not null default '[]'::jsonb check(jsonb_typeof(links)='array'),
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED')),
 revision integer not null default 0 check(revision>=0),
 submitted_at timestamptz,
 score numeric(5,2) check(score between 0 and 100),
 feedback text check(char_length(feedback)<=2500),
 graded_at timestamptz,
 graded_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(assignment_id,student_id)
);
create index submissions_assignment_status on public.assignment_submissions(assignment_id,status);
create table public.submission_files (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
 storage_path text not null unique,
 file_name varchar(160) not null,
 content_type varchar(120) not null,
 byte_size integer not null check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now()
);

-- No authenticated direct writes. Every mutation is checked in a database transaction.
create or replace function public.read_assignment(p_assignment uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists (select 1 from public.assignments a where a.id=p_assignment
 and (public.has_role(array['admin','super_admin']::public.user_role[])
 or public.teaches_class(a.class_id) or (a.published and public.enrolled_in(a.class_id))));
$$;
create or replace function public.manage_assignment(p_assignment uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.assignments a where a.id=p_assignment
 and (public.teaches_class(a.class_id) or public.has_role(array['admin','super_admin']::public.user_role[])));
$$;
create or replace function public.read_submission(p_submission uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.assignment_submissions s where s.id=p_submission
 and (s.student_id=auth.uid() or public.manage_assignment(s.assignment_id)));
$$;
create or replace function public.edit_submission(p_assignment uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.assignments a where a.id=p_assignment and a.published
 and (now()<=a.due_at or a.accept_late) and public.enrolled_in(a.class_id)
 and public.current_role()='mahasiswa');
$$;

-- Reject hostile URL schemes even when an authenticated client bypasses API validation.
create or replace function public.valid_public_links(p_links jsonb,p_max integer) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(jsonb_typeof(p_links)='array' and jsonb_array_length(p_links)<=p_max
 and not exists(
  select 1 from jsonb_array_elements_text(p_links) AS u(link)
  where char_length(u.link)>2048
   or u.link !~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:443)?([/?#][^[:space:]]*)?$'
 ),false);
$$;

create or replace function public.publish_announcement(
 p_class_id uuid,p_audience text,p_title text,p_body text,p_pinned boolean,p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_audience not in ('all','mahasiswa','dosen','admin','super_admin')
 or char_length(trim(p_title)) not between 5 and 150
 or char_length(trim(p_body)) not between 10 and 4000
 or (p_expires_at is not null and p_expires_at<=now()) then raise exception 'Isi pengumuman tidak valid';end if;
 if public.current_role()='dosen' then
  if p_class_id is null or not public.teaches_class(p_class_id)
   or p_audience not in ('all','mahasiswa') then raise exception 'Dosen hanya boleh mengumumkan untuk kelas yang diampu';end if;
 elsif not public.has_role(array['admin','super_admin']::public.user_role[]) then
  raise exception 'Tidak berhak membuat pengumuman';
 end if;
 insert into public.announcements(class_id,author_id,audience,title,body,pinned,expires_at)
 values(p_class_id,auth.uid(),p_audience,trim(p_title),trim(p_body),p_pinned,p_expires_at) returning id into v_id;
 perform public.log_event('ANNOUNCEMENT_PUBLISHED','announcements',v_id);
 return v_id;
end $$;

create or replace function public.save_assignment(
 p_id uuid,p_class_id uuid,p_title text,p_description text,p_component text,
 p_links jsonb,p_due_at timestamptz,p_accept_late boolean
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_class uuid;
begin
 if char_length(trim(p_title)) not between 5 and 150 or char_length(trim(p_description)) not between 10 and 6000
 or p_component not in ('daily_task','group_task','major_project')
 or p_due_at is null or p_due_at<=now() or not public.valid_public_links(p_links,100)
 then raise exception 'Data tugas tidak valid';end if;
 if not public.teaches_class(p_class_id) then raise exception 'Hanya dosen pengampu yang boleh membuat tugas';end if;
 if p_id is null then
  insert into public.assignments(class_id,author_id,title,description,component,resource_links,due_at,accept_late)
  values(p_class_id,auth.uid(),trim(p_title),trim(p_description),p_component,p_links,p_due_at,p_accept_late) returning id into v_id;
  perform public.log_event('ASSIGNMENT_CREATED','assignments',v_id);
 else
  select class_id into v_class from public.assignments where id=p_id for update;
  if v_class is distinct from p_class_id then raise exception 'Kelas tugas tidak dapat diubah';end if;
  -- Changing the grading category after student submissions would corrupt PAP aggregation.
  if exists(select 1 from public.assignment_submissions where assignment_id=p_id)
   and exists(select 1 from public.assignments where id=p_id and component<>p_component)
  then raise exception 'Kategori tugas tidak dapat diubah setelah ada pengumpulan';end if;
  update public.assignments set title=trim(p_title),description=trim(p_description),component=p_component,
  resource_links=p_links,due_at=p_due_at,accept_late=p_accept_late,updated_at=now() where id=p_id returning id into v_id;
  perform public.log_event('ASSIGNMENT_UPDATED','assignments',v_id);
 end if;
 return v_id;
end $$;

create or replace function public.save_submission(p_assignment_id uuid,p_content text,p_links jsonb,p_submit boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_old public.assignment_submissions%rowtype;v_lecturer uuid;v_title text;
begin
 if not public.edit_submission(p_assignment_id) then raise exception 'Tenggat terlewati, tugas tidak dipublikasikan atau mahasiswa bukan peserta';end if;
 if p_content is null or char_length(p_content)>10000
 or not public.valid_public_links(p_links,200)
 then raise exception 'Isi pengumpulan tidak valid';end if;
 -- Preserve SUBMITTED when saving further changes to an already-submitted assignment.
 select * into v_old from public.assignment_submissions where assignment_id=p_assignment_id and student_id=auth.uid() for update;
 -- Prevent a blank submitted record: accept narrative, HTTPS link, or uploaded evidence.
 if p_submit and char_length(trim(p_content))=0 and jsonb_array_length(p_links)=0
  and (v_old.id is null or not exists(select 1 from public.submission_files f where f.submission_id=v_old.id))
 then raise exception 'Pengumpulan perlu catatan, tautan, atau setidaknya satu lampiran';end if;
 if found then
  update public.assignment_submissions set content=p_content,links=p_links,
   status=case when p_submit then 'SUBMITTED'
    when trim(p_content)='' and jsonb_array_length(p_links)=0
     and not exists(select 1 from public.submission_files f where f.submission_id=v_old.id)
    then 'DRAFT' else status end,
   submitted_at=case when p_submit then now()
    when trim(p_content)='' and jsonb_array_length(p_links)=0
     and not exists(select 1 from public.submission_files f where f.submission_id=v_old.id)
    then null when status='SUBMITTED' then now() else submitted_at end,
   revision=revision+1,score=null,feedback=null,graded_at=null,graded_by=null,updated_at=now()
  where id=v_old.id returning id into v_id;
 else
  insert into public.assignment_submissions(assignment_id,student_id,content,links,status,revision,submitted_at)
  values(p_assignment_id,auth.uid(),p_content,p_links,case when p_submit then 'SUBMITTED' else 'DRAFT' end,
   1,case when p_submit then now() else null end) returning id into v_id;
 end if;
 if v_old.id is not null and v_old.score is not null then perform public.refresh_assignment_component(p_assignment_id,auth.uid());end if;
 perform public.log_event(case when p_submit then 'SUBMISSION_SUBMITTED' else 'SUBMISSION_SAVED' end,
   'assignment_submissions',v_id,jsonb_build_object('assignment_id',p_assignment_id));
 if p_submit then
  select p.id,a.title into v_lecturer,v_title from public.assignments a
   join public.classes c on c.id=a.class_id
   join public.profiles p on p.identity_number=c.lecturer_identity_number and p.role='dosen' and p.is_active
   where a.id=p_assignment_id;
  if v_lecturer is not null then
   insert into public.notifications(user_id,title,message,category,action_url)
   values(v_lecturer,'Pengumpulan tugas baru atau revisi',v_title,'SUBMISSION','/tugas/'||p_assignment_id::text);
  end if;
 end if;
 return v_id;
end $$;

create or replace function public.attach_submission_file(p_submission_id uuid,p_path text,p_name text,p_mime text,p_size integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare s public.assignment_submissions%rowtype;v_id uuid;v_used bigint;
begin
 select * into s from public.assignment_submissions where id=p_submission_id for update;
 if not found or s.student_id<>auth.uid() or not public.edit_submission(s.assignment_id)
 then raise exception 'Pengunggahan lampiran ditolak';end if;
 if p_path not like s.assignment_id::text||'/'||s.student_id::text||'/%'
 or char_length(p_path)>280 or char_length(p_name) not between 1 and 160
 or p_size not between 1 and 10485760
 or not exists(select 1 from storage.objects where bucket_id='assignment-private' and name=p_path)
 then raise exception 'Metadata lampiran tidak valid';end if;
 select coalesce(sum(byte_size),0) into v_used from public.submission_files where submission_id=s.id;
 if v_used+p_size>209715200 then raise exception 'Kuota pengumpulan maksimal 200 MB';end if;
 insert into public.submission_files(submission_id,storage_path,file_name,content_type,byte_size)
 values(s.id,p_path,p_name,p_mime,p_size) returning id into v_id;
 update public.assignment_submissions set revision=revision+1,submitted_at=case when status='SUBMITTED' then now() else submitted_at end,
 score=null,feedback=null,graded_at=null,graded_by=null,updated_at=now() where id=s.id;
 if s.score is not null then perform public.refresh_assignment_component(s.assignment_id,s.student_id);end if;
 perform public.log_event('SUBMISSION_FILE_ADDED','submission_files',v_id);
 return v_id;
end $$;
create or replace function public.remove_submission_file(p_file_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_path text;v_assignment uuid;v_owner uuid;v_submission uuid;v_score numeric;
begin
 select f.storage_path,s.assignment_id,s.student_id,s.id,s.score into v_path,v_assignment,v_owner,v_submission,v_score
 from public.submission_files f join public.assignment_submissions s on s.id=f.submission_id where f.id=p_file_id for update of f;
 if v_path is null or v_owner<>auth.uid() or not public.edit_submission(v_assignment) then raise exception 'Tidak boleh menghapus lampiran';end if;
 delete from public.submission_files where id=p_file_id;
 update public.assignment_submissions set revision=revision+1,score=null,feedback=null,graded_at=null,graded_by=null,
 status=case when trim(content)='' and jsonb_array_length(links)=0
   and not exists(select 1 from public.submission_files f where f.submission_id=v_submission) then 'DRAFT' else status end,
 submitted_at=case when trim(content)='' and jsonb_array_length(links)=0
   and not exists(select 1 from public.submission_files f where f.submission_id=v_submission) then null
   when status='SUBMITTED' then now() else submitted_at end,updated_at=now() where id=v_submission;
 if v_score is not null then perform public.refresh_assignment_component(v_assignment,v_owner);end if;
 perform public.log_event('SUBMISSION_FILE_REMOVED','submission_files',p_file_id);
 return v_path;
end $$;
create or replace function public.attach_assignment_file(p_assignment_id uuid,p_path text,p_name text,p_mime text,p_size integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_used bigint;
begin
 if not public.manage_assignment(p_assignment_id) or p_path not like p_assignment_id::text||'/materials/%'
 or char_length(p_path)>280 or char_length(p_name) not between 1 and 160
 or p_size not between 1 and 10485760
 or not exists(select 1 from storage.objects where bucket_id='assignment-private' and name=p_path)
 then raise exception 'Lampiran tugas tidak valid';end if;
 perform 1 from public.assignments where id=p_assignment_id for update;
 select coalesce(sum(byte_size),0) into v_used from public.assignment_files where assignment_id=p_assignment_id;
 if v_used+p_size>209715200 then raise exception 'Kuota materi tugas maksimal 200 MB';end if;
 insert into public.assignment_files(assignment_id,storage_path,file_name,content_type,byte_size)
 values(p_assignment_id,p_path,p_name,p_mime,p_size) returning id into v_id;
 perform public.log_event('ASSIGNMENT_FILE_ADDED','assignment_files',v_id);
 return v_id;
end $$;
create or replace function public.remove_assignment_file(p_file_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_path text;v_assignment uuid;
begin
 select storage_path,assignment_id into v_path,v_assignment from public.assignment_files where id=p_file_id for update;
 if v_path is null or not public.manage_assignment(v_assignment) then raise exception 'Akses lampiran tugas ditolak';end if;
 delete from public.assignment_files where id=p_file_id;
 perform public.log_event('ASSIGNMENT_FILE_REMOVED','assignment_files',p_file_id);
 return v_path;
end $$;

create or replace function public.refresh_assignment_component(p_assignment_id uuid,p_student uuid)
returns void language plpgsql security definer set search_path=public as $$
declare a public.assignments%rowtype;v_avg numeric;
begin
 select * into a from public.assignments where id=p_assignment_id;
 if not found then raise exception 'Tugas tidak ditemukan';end if;
 -- Never allow this privileged writer to be used as a public grade-edit API.
 if p_student<>auth.uid() and not public.manage_assignment(p_assignment_id) then raise exception 'Akses sinkronisasi nilai ditolak';end if;
 select coalesce(round(avg(z.score),2),0) into v_avg from public.assignment_submissions z
 join public.assignments x on x.id=z.assignment_id
 where x.class_id=a.class_id and x.component=a.component and x.published
 and z.student_id=p_student and z.status='SUBMITTED' and z.score is not null;
 insert into public.grades(class_id,student_id) values(a.class_id,p_student) on conflict(class_id,student_id) do nothing;
 if a.component='daily_task' then update public.grades set score_daily_task=v_avg,updated_at=now() where class_id=a.class_id and student_id=p_student;
 elsif a.component='group_task' then update public.grades set score_group_task=v_avg,updated_at=now() where class_id=a.class_id and student_id=p_student;
 else update public.grades set score_major_project=v_avg,updated_at=now() where class_id=a.class_id and student_id=p_student;end if;
end $$;

create or replace function public.grade_submission(p_submission_id uuid,p_score numeric,p_feedback text)
returns void language plpgsql security definer set search_path=public as $$
declare s public.assignment_submissions%rowtype;a public.assignments%rowtype;
begin
 select * into s from public.assignment_submissions where id=p_submission_id for update;
 if not found or s.status<>'SUBMITTED' or p_score is null or p_score<0 or p_score>100
 or char_length(coalesce(p_feedback,''))>2500 then raise exception 'Nilai atau status pengumpulan tidak valid';end if;
 select * into a from public.assignments where id=s.assignment_id;
 if not public.manage_assignment(a.id) then raise exception 'Tidak boleh menilai pengumpulan kelas lain';end if;
 update public.assignment_submissions set score=p_score,feedback=trim(coalesce(p_feedback,'')),graded_at=now(),graded_by=auth.uid(),updated_at=now() where id=s.id;
 -- PAP is recomputed after each grade and after edits invalidate a previous grade.
 perform public.refresh_assignment_component(a.id,s.student_id);
 perform public.log_event('ASSIGNMENT_GRADED','assignment_submissions',s.id,jsonb_build_object('score',p_score,'component',a.component));
end $$;

-- Task-derived components have precedence over manual grade entries when graded
-- submissions exist. This prevents a subsequent manual six-score save from undoing
-- assignment averages. Without graded tasks, manual input remains authoritative.
create or replace function public.enforce_task_grade_components() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_component text;v_average numeric;
begin
 foreach v_component in array array['daily_task','group_task','major_project'] loop
  select round(avg(s.score),2) into v_average from public.assignment_submissions s
   join public.assignments a on a.id=s.assignment_id
   where a.class_id=NEW.class_id and a.component=v_component and a.published
   and s.student_id=NEW.student_id and s.status='SUBMITTED' and s.score is not null;
  if v_average is not null then
   if v_component='daily_task' then NEW.score_daily_task:=v_average;
   elsif v_component='group_task' then NEW.score_group_task:=v_average;
   else NEW.score_major_project:=v_average;end if;
  end if;
 end loop;
 return NEW;
end $$;
create trigger trg_grades_task_precedence before insert or update on public.grades
for each row execute function public.enforce_task_grade_components();

-- Notifications inserted transactionally for announcements, assignments and grading.
create or replace function public.on_announcement_publish() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(user_id,title,message,category,action_url)
 select p.id,NEW.title,left(NEW.body,500),'ANNOUNCEMENT','/pengumuman'
 from public.profiles p where p.is_active and (NEW.audience='all' or p.role::text=NEW.audience)
 and (NEW.class_id is null or
  exists(select 1 from public.class_enrollments e where e.class_id=NEW.class_id and e.student_id=p.id)
  or exists(select 1 from public.classes c where c.id=NEW.class_id and c.lecturer_identity_number=p.identity_number)
  or p.role in ('admin','super_admin'));
 return NEW;
end $$;
create trigger announcement_notification after insert on public.announcements
for each row execute function public.on_announcement_publish();
create or replace function public.on_assignment_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='UPDATE' then
  if NEW.due_at is not distinct from OLD.due_at then return NEW;end if;
 end if;
 insert into public.notifications(user_id,title,message,category,action_url)
  select e.student_id,case when TG_OP='INSERT' then 'Tugas baru' else 'Tenggat tugas diperbarui' end,
   NEW.title||' • batas '||to_char(NEW.due_at at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI')||' WIB',
   'ASSIGNMENT','/tugas/'||NEW.id::text
  from public.class_enrollments e where e.class_id=NEW.class_id;
 return NEW;
end $$;
create trigger assignment_notification after insert or update of due_at on public.assignments
for each row execute function public.on_assignment_change();
create or replace function public.on_submission_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='UPDATE' then
  if NEW.graded_at is distinct from OLD.graded_at and NEW.graded_at is not null then
   insert into public.notifications(user_id,title,message,category,action_url)
   values(NEW.student_id,'Tugas telah dinilai','Nilai: '||NEW.score::text||' / 100','GRADE','/tugas/'||NEW.assignment_id::text);
  end if;
 end if;
 return NEW;
end $$;
create trigger submission_notification after insert or update on public.assignment_submissions
for each row execute function public.on_submission_change();

alter table public.announcements enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_files enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.submission_files enable row level security;
create policy announcements_select on public.announcements for select to authenticated using(
 (expires_at is null or expires_at>now())
 and (public.has_role(array['admin','super_admin']::public.user_role[])
 or (class_id is null and (audience='all' or audience=public.current_role()::text))
 or (class_id is not null and public.can_read_class(class_id)
  and (audience='all' or audience=public.current_role()::text or public.teaches_class(class_id))))
);
create policy assignments_select on public.assignments for select to authenticated using(public.read_assignment(id));
create policy assignment_files_select on public.assignment_files for select to authenticated using(public.read_assignment(assignment_id));
create policy submissions_select on public.assignment_submissions for select to authenticated using(public.read_submission(id));
create policy submission_files_select on public.submission_files for select to authenticated using(public.read_submission(submission_id));

-- Upload/download only via authenticated server endpoints and short-lived signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('assignment-private','assignment-private',false,10485760,
 array['application/pdf','image/png','image/jpeg','image/webp','application/zip',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'text/plain','text/markdown','text/csv']) on conflict(id) do nothing;

-- Grant only RPC execution to authenticated users; functions still verify role/class/ownership.
revoke all on function public.valid_public_links(jsonb,integer) from public,anon;
revoke all on function public.refresh_assignment_component(uuid,uuid) from public,anon,authenticated;
revoke all on function public.read_assignment(uuid) from public,anon;
revoke all on function public.manage_assignment(uuid) from public,anon;
revoke all on function public.read_submission(uuid) from public,anon;
revoke all on function public.edit_submission(uuid) from public,anon;
revoke all on function public.publish_announcement(uuid,text,text,text,boolean,timestamptz) from public,anon;
revoke all on function public.save_assignment(uuid,uuid,text,text,text,jsonb,timestamptz,boolean) from public,anon;
revoke all on function public.save_submission(uuid,text,jsonb,boolean) from public,anon;
revoke all on function public.attach_submission_file(uuid,text,text,text,integer) from public,anon;
revoke all on function public.remove_submission_file(uuid) from public,anon;
revoke all on function public.attach_assignment_file(uuid,text,text,text,integer) from public,anon;
revoke all on function public.remove_assignment_file(uuid) from public,anon;
revoke all on function public.grade_submission(uuid,numeric,text) from public,anon;

-- PostgreSQL defaults can vary by Supabase project; make grants explicit.
revoke all on public.announcements,public.assignments,public.assignment_files,
 public.assignment_submissions,public.submission_files from anon;
revoke insert,update,delete on public.announcements,public.assignments,public.assignment_files,
 public.assignment_submissions,public.submission_files from authenticated;
grant select on public.announcements,public.assignments,public.assignment_files,
 public.assignment_submissions,public.submission_files to authenticated;
grant execute on function public.read_assignment(uuid),public.manage_assignment(uuid),
 public.read_submission(uuid),public.edit_submission(uuid),
 public.publish_announcement(uuid,text,text,text,boolean,timestamptz),
 public.save_assignment(uuid,uuid,text,text,text,jsonb,timestamptz,boolean),
 public.save_submission(uuid,text,jsonb,boolean),
 public.attach_submission_file(uuid,text,text,text,integer),public.remove_submission_file(uuid),
 public.attach_assignment_file(uuid,text,text,text,integer),public.remove_assignment_file(uuid),
 public.grade_submission(uuid,numeric,text) to authenticated;

-- Serialize changes in a single academic year; guard room, lecturer and student cohort,
-- plus two-hour exam collisions across room/lecturer/cohort/shared students. Half-open intervals.
create or replace function public.update_class_schedule(p_class_id uuid,p_day text,p_start time,p_end time,p_room text,p_uts timestamptz,p_uas timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype;
begin
 if not public.has_role(array['admin','super_admin']::public.user_role[]) then raise exception 'Hanya admin boleh memperbarui jadwal';end if;
 select * into c from public.classes where id=p_class_id for update;
 if not found or p_start>=p_end or p_day not in ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')
  or length(trim(p_room)) not between 3 and 100 then raise exception 'Data jadwal tidak valid';end if;
 perform pg_advisory_xact_lock(hashtext('nexus-schedule:'||c.academic_year));
 if p_uts is not null and p_uas is not null
    and p_uts<p_uas+interval '2 hours' and p_uas<p_uts+interval '2 hours'
 then raise exception 'UTS dan UAS kelas yang sama saling berbenturan (120 menit)';end if;
 if exists(select 1 from public.meetings m where m.class_id=p_class_id and m.status='LIVE') then raise exception 'Tutup pertemuan LIVE sebelum mengganti jadwal';end if;
 if exists(select 1 from public.classes other where other.id<>p_class_id and other.academic_year=c.academic_year
  and other.schedule_day=p_day and other.start_time<p_end and other.end_time>p_start
  and (lower(trim(other.room_name))=lower(trim(p_room))
   or other.lecturer_identity_number=c.lecturer_identity_number or other.class_code=c.class_code
   or exists(select 1 from public.class_enrollments e1
    join public.class_enrollments e2 on e2.student_id=e1.student_id
    where e1.class_id=p_class_id and e2.class_id=other.id)))
 then raise exception 'Bentrok jadwal: ruangan, dosen, rombongan, atau peserta KRS yang sama';end if;
 if exists(select 1 from public.classes other where other.id<>p_class_id and other.academic_year=c.academic_year
  and (other.class_code=c.class_code or other.lecturer_identity_number=c.lecturer_identity_number
  or lower(trim(other.room_name))=lower(trim(p_room))
  or exists(select 1 from public.class_enrollments e1
   join public.class_enrollments e2 on e2.student_id=e1.student_id
   where e1.class_id=p_class_id and e2.class_id=other.id))
  and ((p_uts is not null and ((other.uts_schedule is not null and p_uts<other.uts_schedule+interval '2 hours' and other.uts_schedule<p_uts+interval '2 hours')
  or (other.uas_schedule is not null and p_uts<other.uas_schedule+interval '2 hours' and other.uas_schedule<p_uts+interval '2 hours')))
  or (p_uas is not null and ((other.uts_schedule is not null and p_uas<other.uts_schedule+interval '2 hours' and other.uts_schedule<p_uas+interval '2 hours')
  or (other.uas_schedule is not null and p_uas<other.uas_schedule+interval '2 hours' and other.uas_schedule<p_uas+interval '2 hours')))))
 then raise exception 'Bentrok UTS/UAS: ruangan, dosen, rombongan, atau peserta KRS (durasi 120 menit)';end if;
 update public.classes set schedule_day=p_day,start_time=p_start,end_time=p_end,room_name=trim(p_room),uts_schedule=p_uts,uas_schedule=p_uas where id=p_class_id;
 perform public.log_event('SCHEDULE_UPDATED','classes',p_class_id);
end $$;


-- Enrollment must also be checked against existing weekly and exam schedules.
-- Lock in the same order as schedule updates for transaction-safe concurrent edits.
create or replace function public.block_clashing_enrollment() returns trigger
language plpgsql security definer set search_path=public as $$
declare target public.classes%rowtype;
begin
 select * into target from public.classes where id=NEW.class_id;
 if not found then raise exception 'Kelas tidak tersedia';end if;
 perform pg_advisory_xact_lock(hashtext('nexus-schedule:'||target.academic_year));
 if exists(select 1 from public.class_enrollments enrolled
  join public.classes other on other.id=enrolled.class_id
  where enrolled.student_id=NEW.student_id and other.id<>NEW.class_id
   and other.academic_year=target.academic_year
   and ((other.schedule_day=target.schedule_day
      and other.start_time<target.end_time and target.start_time<other.end_time)
    or (target.uts_schedule is not null
      and ((other.uts_schedule is not null and target.uts_schedule<other.uts_schedule+interval '2 hours' and other.uts_schedule<target.uts_schedule+interval '2 hours')
       or (other.uas_schedule is not null and target.uts_schedule<other.uas_schedule+interval '2 hours' and other.uas_schedule<target.uts_schedule+interval '2 hours')))
    or (target.uas_schedule is not null
      and ((other.uts_schedule is not null and target.uas_schedule<other.uts_schedule+interval '2 hours' and other.uts_schedule<target.uas_schedule+interval '2 hours')
       or (other.uas_schedule is not null and target.uas_schedule<other.uas_schedule+interval '2 hours' and other.uas_schedule<target.uas_schedule+interval '2 hours')))))
 then raise exception 'KRS ditolak: mahasiswa sudah memiliki kuliah atau ujian yang bentrok';end if;
 return NEW;
end $$;
create trigger trg_block_clashing_enrollment before insert or update of class_id,student_id
on public.class_enrollments for each row execute function public.block_clashing_enrollment();

-- Trigger functions are not public API endpoints.
revoke all on function public.block_clashing_enrollment() from public,anon,authenticated;
revoke all on function public.enforce_task_grade_components() from public,anon,authenticated;
revoke all on function public.on_announcement_publish() from public,anon,authenticated;
revoke all on function public.on_assignment_change() from public,anon,authenticated;
revoke all on function public.on_submission_change() from public,anon,authenticated;
commit;
