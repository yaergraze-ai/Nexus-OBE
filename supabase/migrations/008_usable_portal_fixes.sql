-- NEXUS OBE v2.6: conditional 2FA enforcement (when TOTP is enrolled), verified email identity repair
-- for Google Sign-In linking, 50 MB multi-format assignment attachments, flexible meeting start + roster
-- attendance RPC, admin KRS delete policy, super-admin user status RPC, and idempotent campus course/meeting/task/RPS data.
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
--    and clean up any accidental cross-account Google identity link where the Google email belongs to another profile.
delete from auth.identities i
using public.profiles p
where i.provider = 'google'
  and lower(coalesce(i.identity_data->>'email', '')) = lower(p.email)
  and i.user_id <> p.id;

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

-- 4. Admin KRS delete policy, Super Admin active status RPC, Lecturer/Admin attendance RPC,
--    and optional-photo / flexible PENGGANTI start_meeting RPC.
drop policy if exists enrollment_admin_delete on public.class_enrollments;
create policy enrollment_admin_delete on public.class_enrollments for delete to authenticated
using (public.has_role(array['admin','super_admin']::public.user_role[]));

create or replace function public.set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path=public as $$
declare v_role public.user_role;
begin
 if not public.has_role(array['super_admin']::public.user_role[]) then
  raise exception 'Khusus super admin';
 end if;
 if p_user_id = auth.uid() then
  raise exception 'Tidak dapat menonaktifkan akun sendiri';
 end if;
 update public.profiles set is_active = p_active, updated_at = now()
 where id = p_user_id returning role into v_role;
 if not found then
  raise exception 'Akun tidak ditemukan';
 end if;
 perform public.log_event('USER_STATUS_UPDATED', 'profiles', p_user_id, jsonb_build_object('is_active', p_active, 'role', v_role));
end $$;

revoke all on function public.set_user_active(uuid, boolean) from public,anon;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;

create or replace function public.mark_student_attendance(
 p_meeting_id uuid, p_student_id uuid, p_status public.attendance_status
) returns void
language plpgsql security definer set search_path=public as $$
declare m public.meetings%rowtype;
begin
 select * into m from public.meetings where id = p_meeting_id for update;
 if not found then raise exception 'Pertemuan tidak ditemukan'; end if;
 if not (public.teaches_class(m.class_id) or public.has_role(array['admin','super_admin']::public.user_role[])) then
  raise exception 'Akses presensi kelas ditolak';
 end if;
 if not exists(select 1 from public.class_enrollments where class_id = m.class_id and student_id = p_student_id) then
  raise exception 'Mahasiswa tidak terdaftar pada kelas';
 end if;
 insert into public.attendances(meeting_id, student_id, status, checked_in_at)
 values (p_meeting_id, p_student_id, p_status, now())
 on conflict (meeting_id, student_id) do update
 set status = excluded.status, checked_in_at = now();
 perform public.log_event('ATTENDANCE_MARKED', 'attendances', p_meeting_id, jsonb_build_object('student_id', p_student_id, 'status', p_status));
end $$;

revoke all on function public.mark_student_attendance(uuid, uuid, public.attendance_status) from public,anon;
grant execute on function public.mark_student_attendance(uuid, uuid, public.attendance_status) to authenticated;

create or replace function public.start_meeting(
 p_class_id uuid, p_type public.meeting_type, p_summary text, p_photo_path text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 c public.classes%rowtype;
 v_id uuid;
 v_date date;
 v_day text;
 v_begin timestamptz;
 v_end timestamptz;
 v_number int;
 v_photo text := coalesce(trim(p_photo_path), '');
begin
 if not public.teaches_class(p_class_id) then
  raise exception 'Hanya dosen pengampu yang dapat membuka pertemuan';
 end if;
 select * into c from public.classes where id = p_class_id for update;
 if not found then raise exception 'Kelas tidak tersedia'; end if;
 if c.pbm_period <> 'on' or not (c.rps_validated_kaprodi and c.rps_validated_dekan) then
  raise exception 'RPS belum tervalidasi atau periode PBM nonaktif';
 end if;
 if length(trim(p_summary)) not between 10 and 2000 then
  raise exception 'Ringkasan harus 10-2000 karakter';
 end if;
 if v_photo <> '' and v_photo not like p_class_id::text || '/%' then
  raise exception 'Jalur dokumentasi tidak sesuai kelas';
 end if;

 v_date := (now() at time zone 'Asia/Jakarta')::date;
 v_day := (array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'])[extract(isodow from v_date)::int];

 if p_type = 'PENGGANTI' then
  v_end := now() + interval '2 hours';
 else
  if c.schedule_day <> v_day then
   raise exception 'Hari ini bukan jadwal kelas. Pilih jenis PENGGANTI untuk membuka sesi di luar jadwal.';
  end if;
  v_begin := (v_date + c.start_time) at time zone 'Asia/Jakarta';
  v_end := (v_date + c.end_time) at time zone 'Asia/Jakarta';
  if now() >= v_end then
   raise exception 'Jam perkuliahan reguler telah berakhir. Pilih jenis PENGGANTI untuk membuka sesi susulan.';
  end if;
  if now() < v_begin - interval '30 minutes' then
   raise exception 'Sesi reguler dibuka paling awal 30 menit sebelum jadwal (atau pilih PENGGANTI).';
  end if;
 end if;

 if exists(select 1 from public.meetings where class_id = p_class_id and status = 'LIVE') then
  raise exception 'Masih ada sesi aktif';
 end if;
 select coalesce(max(meeting_number), 0) + 1 into v_number from public.meetings where class_id = p_class_id;
 if v_number > c.rps_target_meetings then
  raise exception 'Target pertemuan sudah terpenuhi';
 end if;

 insert into public.meetings(class_id, meeting_number, meeting_date, type, summary, documentation_photo_path, status, starts_at, ends_at)
 values(p_class_id, v_number, v_date, p_type, trim(p_summary), v_photo, 'LIVE', now(), v_end)
 returning id into v_id;

 perform public.log_event('MEETING_STARTED', 'meetings', v_id, jsonb_build_object('class_id', p_class_id, 'number', v_number));
 return v_id;
end $$;

-- 5. Auto-enroll any active mahasiswa who currently has 0 KRS classes into non-conflicting active classes.
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
    null;
   end;
  end loop;
 end loop;
end $$;

-- 6. Seed default 100%-consistent RPS OBE trees for any course without RPS yet.
do $$
declare
 v_course record;
 v_cpl1 uuid;
 v_cpl2 uuid;
 v_cpmk1 uuid;
 v_cpmk2 uuid;
 v_cpmk3 uuid;
begin
 for v_course in
  select id, course_code, name_id
  from public.courses c
  where not exists (select 1 from public.rps_cpl r where r.course_id = c.id)
 loop
  insert into public.rps_cpl(course_id, code, description, weight)
  values (v_course.id, 'CPL-01', 'Menguasai konsep fundamental dan analisis masalah pada ' || v_course.name_id, 50)
  returning id into v_cpl1;

  insert into public.rps_cpl(course_id, code, description, weight)
  values (v_course.id, 'CPL-02', 'Merancang, mengimplementasikan, dan mengevaluasi solusi terukur pada ' || v_course.name_id, 50)
  returning id into v_cpl2;

  insert into public.rps_cpmk(course_id, cpl_id, code, description, weight)
  values (v_course.id, v_cpl1, 'CPMK-01', 'Pemahaman teori, terminologi, dan pemodelan inti ' || v_course.course_code, 50)
  returning id into v_cpmk1;

  insert into public.rps_cpmk(course_id, cpl_id, code, description, weight)
  values (v_course.id, v_cpl2, 'CPMK-02', 'Implementasi studi kasus kelompok dan dokumentasi teknis ' || v_course.course_code, 25)
  returning id into v_cpmk2;

  insert into public.rps_cpmk(course_id, cpl_id, code, description, weight)
  values (v_course.id, v_cpl2, 'CPMK-03', 'Evaluasi proyek terintegrasi dan ujian capaian ' || v_course.course_code, 25)
  returning id into v_cpmk3;

  insert into public.rps_sub_cpmk(course_id, cpmk_id, code, description, weight, weight_uts, weight_uas, weight_a, weight_b, weight_c)
  values
   (v_course.id, v_cpmk1, 'Sub-CPMK1', 'Mampu menganalisis konsep dasar dan ruang lingkup studi kasus ' || v_course.name_id, 50, 20, 10, 20, 0, 0),
   (v_course.id, v_cpmk2, 'Sub-CPMK2', 'Mampu menyusun rancangan terstruktur dan presentasi tim ' || v_course.name_id, 25, 0, 10, 0, 15, 0),
   (v_course.id, v_cpmk3, 'Sub-CPMK3', 'Mampu menyelesaikan evaluasi proyek akhir berbasis OBE pada ' || v_course.name_id, 25, 0, 10, 0, 0, 15);
 end loop;
end $$;

-- 7. Seed digital meeting history + per-meeting tasks for classes without meetings yet,
--    and keep an active Tuesday session on NEX-004 so students can test Check-In immediately.
do $$
declare
 v_cls record;
 v_no int;
 v_author uuid;
 v_mid uuid;
 v_base_date date := date '2026-10-19';
 v_due timestamptz := timestamptz '2026-12-05T23:59:00+07:00';
begin
 for v_cls in
  select c.id, c.lecturer_identity_number, c.initial_meeting_count, cr.course_code, cr.name_id
  from public.classes c
  join public.courses cr on cr.id = c.course_id
  where not exists (select 1 from public.meetings m where m.class_id = c.id)
    and c.initial_meeting_count > 0
 loop
  select id into v_author from public.profiles where identity_number = v_cls.lecturer_identity_number limit 1;
  if v_author is null then
   select id into v_author from public.profiles where role = 'admin' limit 1;
  end if;

  for v_no in 1..v_cls.initial_meeting_count loop
   insert into public.meetings(
    class_id, meeting_number, meeting_date, type, summary, documentation_photo_path, status, starts_at, ends_at
   ) values (
    v_cls.id,
    v_no,
    v_base_date + ((v_no - 1) * 7),
    'KULIAH',
    format('Pertemuan #%s %s (%s): Pembahasan materi inti, diskusi kelas, dan latihan terstruktur.', v_no, v_cls.name_id, v_cls.course_code),
    '',
    'COMPLETED_LOCKED',
    ((v_base_date + ((v_no - 1) * 7)) + time '08:00') at time zone 'Asia/Jakarta',
    ((v_base_date + ((v_no - 1) * 7)) + time '10:00') at time zone 'Asia/Jakarta'
   )
   on conflict (class_id, meeting_number) do nothing
   returning id into v_mid;

   if v_mid is null then
    select id into v_mid from public.meetings where class_id = v_cls.id and meeting_number = v_no;
   end if;

   if v_author is not null and v_mid is not null and not exists (select 1 from public.assignments a where a.meeting_id = v_mid) then
    insert into public.assignments(
     class_id, meeting_id, author_id, title, description, component, due_at, accept_late, published
    ) values (
     v_cls.id,
     v_mid,
     v_author,
     format('Tugas Pertemuan %s — %s', v_no, v_cls.name_id),
     format('Kerjakan ringkasan analisis atau unggah dokumen hasil praktik Pertemuan ke-%s mata kuliah %s (%s).', v_no, v_cls.name_id, v_cls.course_code),
     'daily_task',
     v_due,
     true,
     true
    );
   end if;
  end loop;
 end loop;

 -- Open 1 live session on NEX-004 (Tata Tulis Ilmiah) if no LIVE session exists yet so students can test Absen Sekarang.
 select c.id, c.lecturer_identity_number, cr.name_id into v_cls
 from public.classes c
 join public.courses cr on cr.id = c.course_id
 where cr.course_code = 'NEX-004'
 limit 1;

 if v_cls.id is not null and not exists (select 1 from public.meetings where status = 'LIVE' and ends_at > now()) then
  select coalesce(max(meeting_number), 0) + 1 into v_no from public.meetings where class_id = v_cls.id;
  select id into v_author from public.profiles where identity_number = v_cls.lecturer_identity_number limit 1;
  insert into public.meetings(
   class_id, meeting_number, meeting_date, type, summary, documentation_photo_path, status, starts_at, ends_at
  ) values (
   v_cls.id,
   v_no,
   (now() at time zone 'Asia/Jakarta')::date,
   'PENGGANTI',
   'Sesi Terbuka Pertemuan #' || v_no || ' — Mahasiswa dapat mengisi presensi mandiri (Absen Sekarang) dan mendiskusikan struktur metodologi & daftar pustaka.',
   '',
   'LIVE',
   now(),
   now() + interval '12 hours'
  )
  on conflict (class_id, meeting_number) do nothing
  returning id into v_mid;

  if v_author is not null and v_mid is not null and not exists (select 1 from public.assignments a where a.meeting_id = v_mid) then
   insert into public.assignments(
    class_id, meeting_id, author_id, title, description, component, due_at, accept_late, published
   ) values (
    v_cls.id,
    v_mid,
    v_author,
    'Tugas Pertemuan ' || v_no || ' — Kerangka Metodologi & Referensi Ilmiah',
    'Unggah draf kerangka metodologi penelitian (format PDF/Word/Markdown) untuk dikaji bersama pada pertemuan berlangsung.',
    'daily_task',
    now() + interval '7 days',
    true,
    true
   );
  end if;
 end if;
end $$;

commit;
