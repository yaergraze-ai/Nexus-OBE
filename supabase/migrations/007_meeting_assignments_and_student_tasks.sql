-- NEXUS OBE v2.5: meeting-linked assignments, student-authored tasks (visible to lecturer, deletable by student author),
-- and real Pertemuan 1-5 + Tugas 1-5 seed for NEX-002 Analisis dan Design PL TI24D.
-- Apply AFTER 001..006 and `npm run provision:roles`.
begin;

-- 1. Optional link between each assignment and a class meeting.
alter table public.assignments
 add column if not exists meeting_id uuid references public.meetings(id) on delete set null;

create index if not exists assignments_meeting_idx
 on public.assignments(meeting_id, due_at);

-- 2. Allow both class lecturers and enrolled students to create assignments;
--    editing is restricted to class lecturers, admins, or the student author.
drop function if exists public.save_assignment(uuid,uuid,text,text,text,jsonb,timestamptz,boolean);

create or replace function public.save_assignment(
 p_id uuid,
 p_class_id uuid,
 p_title text,
 p_description text,
 p_component text,
 p_links jsonb,
 p_due_at timestamptz,
 p_accept_late boolean,
 p_meeting_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 v_id uuid;
 v_existing public.assignments%rowtype;
 v_role public.user_role := public.current_role();
 v_can_teacher boolean := public.teaches_class(p_class_id) or public.has_role(array['admin','super_admin']::public.user_role[]);
 v_can_student boolean := (v_role = 'mahasiswa' and public.enrolled_in(p_class_id));
begin
 if char_length(trim(p_title)) not between 5 and 150
  or char_length(trim(p_description)) not between 10 and 6000
  or p_component not in ('daily_task','group_task','major_project')
  or p_due_at is null
  or not public.valid_public_links(p_links, 100) then
  raise exception 'Data tugas tidak valid';
 end if;

 if p_meeting_id is not null and not exists(
  select 1 from public.meetings m where m.id = p_meeting_id and m.class_id = p_class_id
 ) then
  raise exception 'Pertemuan yang dipilih tidak sesuai dengan kelas';
 end if;

 if p_id is null then
  if not (v_can_teacher or v_can_student) then
   raise exception 'Hanya dosen pengampu atau mahasiswa terdaftar pada kelas ini yang boleh menambah tugas';
  end if;

  insert into public.assignments(
   class_id, meeting_id, author_id, title, description, component, resource_links, due_at, accept_late
  )
  values(
   p_class_id, p_meeting_id, auth.uid(), trim(p_title), trim(p_description),
   p_component, p_links, p_due_at, coalesce(p_accept_late, true)
  )
  returning id into v_id;

  perform public.log_event(
   'ASSIGNMENT_CREATED',
   'assignments',
   v_id,
   jsonb_build_object('class_id', p_class_id, 'meeting_id', p_meeting_id, 'author_role', v_role::text)
  );
 else
  select * into v_existing from public.assignments where id = p_id for update;
  if not found then
   raise exception 'Tugas tidak ditemukan';
  end if;
  if v_existing.class_id is distinct from p_class_id then
   raise exception 'Kelas tugas tidak dapat diubah';
  end if;
  if not (
   public.teaches_class(v_existing.class_id)
   or public.has_role(array['admin','super_admin']::public.user_role[])
   or (v_existing.author_id = auth.uid() and v_can_student)
  ) then
   raise exception 'Anda tidak memiliki izin untuk mengubah tugas ini';
  end if;
  if exists(select 1 from public.assignment_submissions where assignment_id = p_id)
   and v_existing.component <> p_component then
   raise exception 'Kategori tugas tidak dapat diubah setelah ada pengumpulan';
  end if;

  update public.assignments
  set meeting_id = p_meeting_id,
      title = trim(p_title),
      description = trim(p_description),
      component = p_component,
      resource_links = p_links,
      due_at = p_due_at,
      accept_late = p_accept_late,
      updated_at = now()
  where id = p_id
  returning id into v_id;

  perform public.log_event('ASSIGNMENT_UPDATED', 'assignments', v_id);
 end if;

 return v_id;
end $$;

-- 3. Allow deletion by the student author who created it, the class lecturer, or admin/super_admin.
create or replace function public.delete_assignment(p_assignment_id uuid)
returns boolean
language plpgsql security definer set search_path=public as $$
declare
 v_existing public.assignments%rowtype;
begin
 select * into v_existing from public.assignments where id = p_assignment_id for update;
 if not found then
  raise exception 'Tugas tidak ditemukan';
 end if;

 if not (
  public.teaches_class(v_existing.class_id)
  or public.has_role(array['admin','super_admin']::public.user_role[])
  or (
   v_existing.author_id = auth.uid()
   and public.current_role() = 'mahasiswa'
   and public.enrolled_in(v_existing.class_id)
  )
 ) then
  raise exception 'Hanya pembuat tugas atau dosen pengampu yang boleh menghapus tugas ini';
 end if;

 delete from public.assignments where id = p_assignment_id;
 perform public.log_event(
  'ASSIGNMENT_DELETED',
  'assignments',
  p_assignment_id,
  jsonb_build_object('class_id', v_existing.class_id, 'title', v_existing.title)
 );
 return true;
end $$;

revoke all on function public.save_assignment(uuid,uuid,text,text,text,jsonb,timestamptz,boolean,uuid) from public,anon;
revoke all on function public.delete_assignment(uuid) from public,anon;
grant execute on function public.save_assignment(uuid,uuid,text,text,text,jsonb,timestamptz,boolean,uuid),
 public.delete_assignment(uuid) to authenticated;

-- 4. Notify enrolled classmates AND class lecturer when an assignment is created/updated.
create or replace function public.on_assignment_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if TG_OP = 'UPDATE' then
  if NEW.due_at is not distinct from OLD.due_at then
   return NEW;
  end if;
 end if;

 insert into public.notifications(user_id, title, message, category, action_url)
 select e.student_id,
  case when TG_OP = 'INSERT' then 'Tugas baru' else 'Tenggat tugas diperbarui' end,
  NEW.title || ' • batas ' || to_char(NEW.due_at at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB',
  'ASSIGNMENT',
  '/tugas/' || NEW.id::text
 from public.class_enrollments e
 where e.class_id = NEW.class_id
   and e.student_id <> NEW.author_id;

 if TG_OP = 'INSERT' then
  insert into public.notifications(user_id, title, message, category, action_url)
  select p.id,
   'Tugas kelas ditambahkan',
   NEW.title || ' • batas ' || to_char(NEW.due_at at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB',
   'ASSIGNMENT',
   '/tugas/' || NEW.id::text
  from public.classes c
  join public.profiles p on p.identity_number = c.lecturer_identity_number
  where c.id = NEW.class_id
    and p.is_active
    and p.id <> NEW.author_id;
 end if;

 return NEW;
end $$;

-- 5. Align NEX-002 lecturer to DIAN NOVIANTI (0421117105) + enroll Kana + seed RPS, Pertemuan 1-5 & Tugas 1-5.
insert into public.lecturer_directory(identity_number, full_name)
values ('0421117105', 'DIAN NOVIANTI')
on conflict (identity_number) do update set full_name = excluded.full_name;

update public.classes
set lecturer_identity_number = '0421117105',
    initial_meeting_count = greatest(initial_meeting_count, 5)
where lecturer_identity_number = '0431117105'
   or course_id in (select id from public.courses where course_code = 'NEX-002');

delete from public.lecturer_directory
where identity_number = '0431117105'
  and not exists (select 1 from public.classes where lecturer_identity_number = '0431117105');

do $$
declare
 v_course_id uuid;
 v_class_id uuid;
 v_lecturer_id uuid;
 v_kana_id uuid;
 v_m1 uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid; v_m5 uuid;
begin
 select id into v_course_id from public.courses where course_code = 'NEX-002' limit 1;
 select id into v_class_id from public.classes where course_id = v_course_id and class_code = 'TI24D' limit 1;

 if v_course_id is null or v_class_id is null then
  return;
 end if;

 -- Enroll Kana if profile exists.
 select id into v_kana_id from public.profiles where identity_number = '240511088' limit 1;
 if v_kana_id is not null then
  insert into public.class_enrollments(class_id, student_id)
  values (v_class_id, v_kana_id)
  on conflict (class_id, student_id) do nothing;
 end if;

 -- RPS CPL/CPMK/Sub-CPMK Minggu 1-5 for NEX-002 (Analisis dan Design PL).
 insert into public.rps_cpl(course_id, code, description, weight) values
  (v_course_id, 'CPL04', 'Mampu menganalisis kebutuhan dan merancang arsitektur perangkat lunak yang terstruktur dan berorientasi objek.', 50),
  (v_course_id, 'CPL08', 'Mampu mendokumentasikan spesifikasi sistem (SRS) dan mempresentasikannya secara efektif.', 50)
 on conflict (course_id, code) do nothing;

 insert into public.rps_cpmk(course_id, cpl_id, code, description, weight)
 select v_course_id, cp.id, i.code, i.description, i.weight
 from (values
  ('CPL04', 'CPMK 1', 'Memahami SDLC, perbandingan analisis terstruktur vs berorientasi objek, serta teknik elisitasi kebutuhan.', 50),
  ('CPL08', 'CPMK 2', 'Merumuskan kebutuhan fungsional/non-fungsional, user story, prioritas MoSCoW, dan dokumen SRS ISO/IEC/IEEE 29148.', 50)
 ) i(cpl_code, code, description, weight)
 join public.rps_cpl cp on cp.course_id = v_course_id and cp.code = i.cpl_code
 on conflict (course_id, code) do nothing;

 insert into public.rps_sub_cpmk(course_id, cpmk_id, code, description, weight, weight_uts, weight_uas, weight_a, weight_b, weight_c)
 select v_course_id, cm.id, i.code, i.description, i.w, i.uts, i.uas, i.a, i.b, i.c
 from (values
  ('CPMK 1', 'Sub-CPMK 1', 'Menjelaskan konsep SDLC serta membandingkan model Waterfall, Prototyping, Spiral, dan Agile', 15, 5, 0, 5, 5, 0),
  ('CPMK 1', 'Sub-CPMK 2', 'Menjelaskan pendekatan analisis terstruktur dan berorientasi objek beserta perbedaannya', 15, 5, 0, 5, 5, 0),
  ('CPMK 1', 'Sub-CPMK 3', 'Menerapkan teknik elisitasi kebutuhan (wawancara, observasi, kuesioner, workshop)', 20, 10, 0, 5, 5, 0),
  ('CPMK 2', 'Sub-CPMK 4', 'Merumuskan kebutuhan fungsional dan non-fungsional, user story, serta prioritas MoSCoW', 25, 0, 10, 5, 5, 5),
  ('CPMK 2', 'Sub-CPMK 5', 'Menyusun dokumen SRS berdasarkan standar ISO/IEC/IEEE 29148', 25, 0, 10, 5, 0, 10)
 ) i(cpmk_code, code, description, w, uts, uas, a, b, c)
 join public.rps_cpmk cm on cm.course_id = v_course_id and cm.code = i.cpmk_code
 on conflict (course_id, code) do nothing;

 -- Pertemuan 1-5 records matching class timeline.
 insert into public.meetings(class_id, meeting_number, meeting_date, type, summary, documentation_photo_path, status, starts_at, ends_at)
 values
  (v_class_id, 1, '2026-10-19', 'KULIAH', 'Bab 1 — Konsep SDLC dan perbandingan model Waterfall, Prototyping, Spiral, serta Agile.', '', 'COMPLETED_LOCKED', '2026-10-19 12:43:03+07'::timestamptz, '2026-10-19 14:34:45+07'::timestamptz),
  (v_class_id, 2, '2026-10-26', 'KULIAH', 'Presentasi Project Website (BAB 2) — Analisis terstruktur dan berorientasi objek beserta perbedaannya.', '', 'COMPLETED_LOCKED', '2026-10-26 13:21:43+07'::timestamptz, '2026-10-26 14:44:21+07'::timestamptz),
  (v_class_id, 3, '2026-11-02', 'KULIAH', 'Melanjutkan presentasi BAB II, pengecekan proposal dan project web, serta teknik elisitasi kebutuhan.', '', 'COMPLETED_LOCKED', '2026-11-02 14:12:04+07'::timestamptz, '2026-11-02 15:06:12+07'::timestamptz),
  (v_class_id, 4, '2026-11-09', 'KULIAH', 'Pembahasan materi pertemuan 4 — Kebutuhan fungsional, non-fungsional, user story, dan prioritas MoSCoW.', '', 'COMPLETED_LOCKED', '2026-11-09 14:14:49+07'::timestamptz, '2026-11-09 15:15:57+07'::timestamptz),
  (v_class_id, 5, '2026-11-16', 'KULIAH', 'Soal Quiz: 1. Beri judul Project System Anda, jelaskan latar belakang minimal 5 paragraf beserta sitasinya. 2. Jabarkan urgensi penelitian Anda beserta Manfaat Penelitian! 3. Jelaskan Metode Penelitian yang digunakan dan perbedaannya dari penelitian sebelumnya (5 kajian referensi ditinjau dari Metode Penelitian). 4. Uraikan tools yang digunakan! 5. Tuliskan Daftar Pustaka minimal 30 referensi.', '', 'COMPLETED_LOCKED', '2026-11-16 13:15:58+07'::timestamptz, '2026-11-16 15:30:00+07'::timestamptz)
 on conflict (class_id, meeting_number) do nothing;

 select id into v_m1 from public.meetings where class_id = v_class_id and meeting_number = 1;
 select id into v_m2 from public.meetings where class_id = v_class_id and meeting_number = 2;
 select id into v_m3 from public.meetings where class_id = v_class_id and meeting_number = 3;
 select id into v_m4 from public.meetings where class_id = v_class_id and meeting_number = 4;
 select id into v_m5 from public.meetings where class_id = v_class_id and meeting_number = 5;

 if v_kana_id is not null then
  insert into public.attendances(meeting_id, student_id, status)
  select m_id, v_kana_id, 'HADIR'::public.attendance_status
  from unnest(array[v_m1, v_m2, v_m3, v_m4, v_m5]) as m_id
  where m_id is not null
  on conflict (meeting_id, student_id) do nothing;
 end if;

 -- Author for seed tasks: DIAN NOVIANTI (fallback to any admin/profile if lecturer hasn't provisioned yet).
 select id into v_lecturer_id from public.profiles
 where identity_number in ('0421117105', '0431117105') or role in ('dosen', 'admin', 'super_admin')
 order by case identity_number when '0421117105' then 0 when '0431117105' then 1 else 2 end
 limit 1;

 if v_lecturer_id is not null then
  insert into public.assignments(class_id, meeting_id, author_id, title, description, component, resource_links, due_at, accept_late, published)
  select v_class_id, s.meeting_id, v_lecturer_id, s.title, s.description, s.component, '[]'::jsonb, s.due_at, true, true
  from (values
   (v_m1, 'Tugas Pertemuan 1 — Konsep SDLC & Model Proses (Bab 1)',
    'Jelaskan tahapan SDLC serta bandingkan kelebihan dan kekurangan model Waterfall, Prototyping, Spiral, dan Agile berdasarkan karakteristik studi kasus proyek perangkat lunak Anda (Sub-CPMK 1).',
    'daily_task', '2026-11-30 23:59:00+07'::timestamptz),
   (v_m2, 'Tugas Pertemuan 2 — Presentasi Project Website (BAB 2) & Analisis Terstruktur vs OOP',
    'Unggah dokumen/ringkasan BAB 2 Project Website yang menjelaskan pendekatan analisis terstruktur (DFD/ERD) dan berorientasi objek (UML) beserta artefak dan perbedaannya pada kasus yang dipilih (Sub-CPMK 2).',
    'daily_task', '2026-12-03 23:59:00+07'::timestamptz),
   (v_m3, 'Tugas Pertemuan 3 — Instrumen & Dokumentasi Elisitasi Kebutuhan',
    'Lanjutkan perbaikan BAB II, pengecekan proposal & project web, lalu unggah instrumen serta dokumentasi hasil elisitasi kebutuhan (wawancara, observasi, kuesioner, atau workshop) bersama mitra (Sub-CPMK 3).',
    'daily_task', '2026-12-07 23:59:00+07'::timestamptz),
   (v_m4, 'Tugas Pertemuan 4 — Kebutuhan Fungsional, User Story & Prioritas MoSCoW',
    'Rumuskan daftar kebutuhan fungsional dan non-fungsional sistem, tuliskan user story lengkap dengan acceptance criteria, serta susun prioritas MoSCoW yang beralasan (Sub-CPMK 4).',
    'daily_task', '2026-12-10 23:59:00+07'::timestamptz),
   (v_m5, 'Tugas Pertemuan 5 (Quiz) — Proposal Project System & Standar SRS ISO/IEC/IEEE 29148',
    E'Soal Quiz Pertemuan 5:\n1. Beri judul Project System Anda, kemudian jelaskan latar belakang minimal 5 paragraf beserta sitasinya.\n2. Jabarkan urgensi penelitian Anda beserta Manfaat Penelitian!\n3. Jelaskan Metode Penelitian yang digunakan dan jelaskan perbedaannya dari penelitian sebelumnya. Buatkan 5 kajian referensi sebelumnya ditinjau dari Metode Penelitian!\n4. Uraikan tools yang digunakan!\n5. Tuliskan Daftar Pustaka (minimal 30 referensi yang digunakan).',
    'daily_task', '2026-12-14 23:59:00+07'::timestamptz)
  ) s(meeting_id, title, description, component, due_at)
  where s.meeting_id is not null
    and not exists (select 1 from public.assignments a where a.meeting_id = s.meeting_id);
 end if;
end $$;

commit;
