-- NEXUS OBE v2.6: conditional 2FA enforcement (when TOTP is enrolled), verified email identity repair
-- for Google Sign-In linking, 50 MB multi-format assignment attachments, and default KRS enrollment
-- for existing self-registered students.
-- Apply AFTER 001..007.
begin;

-- 1. Enforce AAL2 only when the user actually has a verified MFA factor enrolled.
create or replace function public.check_mfa()
returns boolean
language sql stable security definer set search_path=public as $$
 select (
  not exists (
   select 1 from auth.mfa_factors f
   where f.user_id = (select auth.uid()) and f.status = 'verified'
  )
  or coalesce(auth.jwt()->>'aal', '') = 'aal2'
 );
$$;

create or replace function public.has_role(p_roles public.user_role[])
returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(public.current_role() = any(p_roles), false)
  and (public.current_role() = 'mahasiswa' or public.check_mfa());
$$;

create or replace function public.teaches_class(p_class uuid)
returns boolean
language sql stable security definer set search_path=public as $$
 select exists (
  select 1
  from public.classes c
  join public.profiles p on p.identity_number = c.lecturer_identity_number
  where c.id = p_class
    and p.id = (select auth.uid())
    and p.role = 'dosen'
    and p.is_active
    and public.check_mfa()
 );
$$;

revoke all on function public.check_mfa() from public,anon;
grant execute on function public.check_mfa() to authenticated;

-- 2. Repair auth.identities email_verified flag for confirmed accounts created via admin API
--    so Supabase automatic Google Sign-In linking works smoothly.
update auth.identities i
set identity_data = coalesce(i.identity_data, '{}'::jsonb) || jsonb_build_object('email_verified', true)
from auth.users u
where i.user_id = u.id
  and i.provider = 'email'
  and u.email_confirmed_at is not null
  and coalesce((i.identity_data->>'email_verified')::boolean, false) = false;

create or replace function public.sync_verified_email_identity(p_user_id uuid)
returns void
language plpgsql security definer set search_path=public as $$
begin
 update auth.identities i
 set identity_data = coalesce(i.identity_data, '{}'::jsonb) || jsonb_build_object('email_verified', true)
 from auth.users u
 where i.user_id = p_user_id
   and u.id = p_user_id
   and i.provider = 'email'
   and u.email_confirmed_at is not null;
end $$;

revoke all on function public.sync_verified_email_identity(uuid) from public,anon,authenticated;
grant execute on function public.sync_verified_email_identity(uuid) to service_role;

-- 3. Expand assignment-private storage bucket and table limits to 50 MB + Word/Excel/PPT/RAR/7z.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
 'assignment-private',
 'assignment-private',
 false,
 52428800,
 array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
  'text/csv'
 ]
)
on conflict (id) do update set
 public = false,
 file_size_limit = 52428800,
 allowed_mime_types = excluded.allowed_mime_types;

alter table public.assignment_files drop constraint if exists assignment_files_byte_size_check;
alter table public.assignment_files add constraint assignment_files_byte_size_check check (byte_size between 1 and 52428800);

alter table public.submission_files drop constraint if exists submission_files_byte_size_check;
alter table public.submission_files add constraint submission_files_byte_size_check check (byte_size between 1 and 52428800);

create or replace function public.attach_submission_file(
 p_submission_id uuid, p_path text, p_name text, p_mime text, p_size integer
) returns uuid
language plpgsql security definer set search_path=public as $$
declare s public.assignment_submissions%rowtype; v_id uuid; v_used bigint;
begin
 select * into s from public.assignment_submissions where id = p_submission_id for update;
 if not found or s.student_id <> auth.uid() or not public.edit_submission(s.assignment_id) then
  raise exception 'Pengunggahan lampiran ditolak';
 end if;
 if p_path not like s.assignment_id::text || '/' || s.student_id::text || '/%'
  or char_length(p_path) > 280 or char_length(p_name) not between 1 and 160
  or p_size not between 1 and 52428800
  or not exists(select 1 from storage.objects where bucket_id = 'assignment-private' and name = p_path) then
  raise exception 'Metadata lampiran tidak valid';
 end if;
 select coalesce(sum(byte_size), 0) into v_used from public.submission_files where submission_id = s.id;
 if v_used + p_size > 209715200 then
  raise exception 'Kuota pengumpulan maksimal 200 MB';
 end if;
 insert into public.submission_files(submission_id, storage_path, file_name, content_type, byte_size)
 values(s.id, p_path, p_name, p_mime, p_size) returning id into v_id;
 update public.assignment_submissions
 set revision = revision + 1,
     submitted_at = case when status = 'SUBMITTED' then now() else submitted_at end,
     score = null, feedback = null, graded_at = null, graded_by = null, updated_at = now()
 where id = s.id;
 if s.score is not null then
  perform public.refresh_assignment_component(s.assignment_id, s.student_id);
 end if;
 perform public.log_event('SUBMISSION_FILE_ADDED', 'submission_files', v_id);
 return v_id;
end $$;

create or replace function public.attach_assignment_file(
 p_assignment_id uuid, p_path text, p_name text, p_mime text, p_size integer
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_used bigint;
begin
 if not public.manage_assignment(p_assignment_id)
  or p_path not like p_assignment_id::text || '/materials/%'
  or char_length(p_path) > 280 or char_length(p_name) not between 1 and 160
  or p_size not between 1 and 52428800
  or not exists(select 1 from storage.objects where bucket_id = 'assignment-private' and name = p_path) then
  raise exception 'Lampiran tugas tidak valid';
 end if;
 perform 1 from public.assignments where id = p_assignment_id for update;
 select coalesce(sum(byte_size), 0) into v_used from public.assignment_files where assignment_id = p_assignment_id;
 if v_used + p_size > 209715200 then
  raise exception 'Kuota materi tugas maksimal 200 MB';
 end if;
 insert into public.assignment_files(assignment_id, storage_path, file_name, content_type, byte_size)
 values(p_assignment_id, p_path, p_name, p_mime, p_size) returning id into v_id;
 perform public.log_event('ASSIGNMENT_FILE_ADDED', 'assignment_files', v_id);
 return v_id;
end $$;

-- 4. Auto-enroll any active mahasiswa who currently has 0 KRS classes into non-conflicting active classes.
do $$
declare
 v_student record;
 v_class record;
begin
 for v_student in
  select p.id
  from public.profiles p
  where p.role = 'mahasiswa'
    and p.is_active
    and not exists (select 1 from public.class_enrollments e where e.student_id = p.id)
 loop
  for v_class in
   select c.id
   from public.classes c
   join public.courses cr on cr.id = c.course_id
   order by case when cr.course_code = 'NEX-002' then 0 else 1 end, c.class_code asc
  loop
   begin
    insert into public.class_enrollments(class_id, student_id)
    values (v_class.id, v_student.id)
    on conflict (class_id, student_id) do nothing;
   exception when others then
    -- Lewati kelas yang bentrok jadwal dengan kelas terpilih sebelumnya.
    null;
   end;
  end loop;
 end loop;
end $$;

commit;
