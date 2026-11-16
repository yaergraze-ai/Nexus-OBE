-- NEXUS OBE v2.3: meeting journal references (unlimited links/files) + initial password change tracking.
-- Apply AFTER 001, 002, seed, 003, 004.
begin;

alter table public.profiles
 add column if not exists must_change_password boolean not null default false;

-- Prevent non-admin users from tampering with must_change_password directly via REST.
create or replace function public.profile_self_edit_guard() returns trigger
language plpgsql set search_path=public as $$
begin
 if auth.uid()=old.id and not public.has_role(array['admin','super_admin']::public.user_role[]) then
  if new.id is distinct from old.id or new.email is distinct from old.email
   or new.identity_number is distinct from old.identity_number or new.role is distinct from old.role
   or new.is_active is distinct from old.is_active or new.faculty is distinct from old.faculty
   or new.study_program is distinct from old.study_program
   or new.must_change_password is distinct from old.must_change_password
   or new.created_at is distinct from old.created_at then
    raise exception 'Only display name and avatar are editable';
  end if;
 end if;
 return new;
end;$$;

-- Journal references & supporting files attached to each class meeting (no per-meeting limit).
create table if not exists public.meeting_references (
 id uuid primary key default gen_random_uuid(),
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 class_id uuid not null references public.classes(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 title varchar(220) not null check (char_length(trim(title)) between 2 and 220),
 citation text not null default '' check (char_length(citation) <= 1000),
 reference_url text check (
  reference_url is null or (
   char_length(reference_url) <= 2048
   and reference_url ~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:443)?([/?#][^[:space:]]*)?$'
  )
 ),
 notes text not null default '' check (char_length(notes) <= 2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists meeting_references_meeting_idx
 on public.meeting_references(meeting_id, created_at asc);
create index if not exists meeting_references_class_idx
 on public.meeting_references(class_id);

create table if not exists public.meeting_reference_files (
 id uuid primary key default gen_random_uuid(),
 reference_id uuid not null references public.meeting_references(id) on delete cascade,
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 class_id uuid not null references public.classes(id) on delete cascade,
 storage_path text not null unique,
 file_name varchar(180) not null check (char_length(trim(file_name)) between 1 and 180),
 content_type varchar(150) not null,
 byte_size bigint not null check (byte_size between 1 and 52428800),
 created_at timestamptz not null default now()
);

create index if not exists meeting_reference_files_ref_idx
 on public.meeting_reference_files(reference_id, created_at asc);
create index if not exists meeting_reference_files_meeting_idx
 on public.meeting_reference_files(meeting_id);

create or replace function public.can_manage_meeting_reference(p_class uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.teaches_class(p_class) or public.has_role(array['admin','super_admin']::public.user_role[]);
$$;

create or replace function public.save_meeting_reference(
 p_id uuid,
 p_meeting_id uuid,
 p_title text,
 p_citation text,
 p_url text,
 p_notes text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 v_meeting public.meetings%rowtype;
 v_old public.meeting_references%rowtype;
 v_id uuid;
 v_clean_url text := nullif(trim(coalesce(p_url,'')), '');
begin
 select * into v_meeting from public.meetings where id=p_meeting_id;
 if not found then raise exception 'Pertemuan tidak ditemukan'; end if;
 if not public.can_manage_meeting_reference(v_meeting.class_id) then
  raise exception 'Hanya dosen pengampu atau admin yang dapat mengelola referensi pertemuan';
 end if;
 if char_length(trim(coalesce(p_title,''))) not between 2 and 220
  or char_length(coalesce(p_citation,'')) > 1000
  or char_length(coalesce(p_notes,'')) > 2000 then
  raise exception 'Data referensi jurnal tidak valid';
 end if;
 if v_clean_url is not null and (
  char_length(v_clean_url) > 2048
  or v_clean_url !~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:443)?([/?#][^[:space:]]*)?$'
 ) then
  raise exception 'Tautan referensi wajib menggunakan HTTPS publik yang valid';
 end if;

 if p_id is null then
  insert into public.meeting_references(meeting_id, class_id, created_by, title, citation, reference_url, notes)
  values (v_meeting.id, v_meeting.class_id, auth.uid(), trim(p_title), trim(coalesce(p_citation,'')), v_clean_url, trim(coalesce(p_notes,'')))
  returning id into v_id;
  perform public.log_event('MEETING_REFERENCE_ADDED', 'meeting_references', v_id, jsonb_build_object('meeting_id', v_meeting.id));
 else
  select * into v_old from public.meeting_references where id=p_id for update;
  if not found or v_old.meeting_id <> v_meeting.id then
   raise exception 'Referensi tidak ditemukan pada pertemuan ini';
  end if;
  update public.meeting_references
  set title=trim(p_title),
      citation=trim(coalesce(p_citation,'')),
      reference_url=v_clean_url,
      notes=trim(coalesce(p_notes,'')),
      updated_at=now()
  where id=p_id
  returning id into v_id;
  perform public.log_event('MEETING_REFERENCE_UPDATED', 'meeting_references', v_id, jsonb_build_object('meeting_id', v_meeting.id));
 end if;
 return v_id;
end;$$;

create or replace function public.delete_meeting_reference(p_reference_id uuid)
returns text[]
language plpgsql security definer set search_path=public as $$
declare
 v_ref public.meeting_references%rowtype;
 v_paths text[];
begin
 select * into v_ref from public.meeting_references where id=p_reference_id for update;
 if not found then raise exception 'Referensi tidak ditemukan'; end if;
 if not public.can_manage_meeting_reference(v_ref.class_id) then
  raise exception 'Tidak berhak menghapus referensi';
 end if;
 select coalesce(array_agg(storage_path), '{}'::text[]) into v_paths
 from public.meeting_reference_files where reference_id=p_reference_id;
 delete from public.meeting_references where id=p_reference_id;
 perform public.log_event('MEETING_REFERENCE_DELETED', 'meeting_references', p_reference_id, jsonb_build_object('meeting_id', v_ref.meeting_id));
 return v_paths;
end;$$;

create or replace function public.attach_meeting_reference_file(
 p_reference_id uuid,
 p_path text,
 p_name text,
 p_mime text,
 p_size bigint
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 v_ref public.meeting_references%rowtype;
 v_id uuid;
begin
 select * into v_ref from public.meeting_references where id=p_reference_id for update;
 if not found then raise exception 'Referensi tidak ditemukan'; end if;
 if not public.can_manage_meeting_reference(v_ref.class_id) then
  raise exception 'Tidak berhak mengunggah berkas referensi';
 end if;
 if p_path not like v_ref.class_id::text||'/'||v_ref.meeting_id::text||'/%'
  or char_length(p_path) > 320
  or char_length(trim(coalesce(p_name,''))) not between 1 and 180
  or p_size not between 1 and 52428800
  or not exists(select 1 from storage.objects where bucket_id='meeting-references' and name=p_path) then
  raise exception 'Metadata berkas referensi tidak valid';
 end if;
 insert into public.meeting_reference_files(reference_id, meeting_id, class_id, storage_path, file_name, content_type, byte_size)
 values (v_ref.id, v_ref.meeting_id, v_ref.class_id, p_path, trim(p_name), p_mime, p_size)
 returning id into v_id;
 perform public.log_event('MEETING_REFERENCE_FILE_ADDED', 'meeting_reference_files', v_id, jsonb_build_object('meeting_id', v_ref.meeting_id));
 return v_id;
end;$$;

create or replace function public.remove_meeting_reference_file(p_file_id uuid)
returns text
language plpgsql security definer set search_path=public as $$
declare
 v_file public.meeting_reference_files%rowtype;
begin
 select * into v_file from public.meeting_reference_files where id=p_file_id for update;
 if not found then raise exception 'Berkas referensi tidak ditemukan'; end if;
 if not public.can_manage_meeting_reference(v_file.class_id) then
  raise exception 'Tidak berhak menghapus berkas referensi';
 end if;
 delete from public.meeting_reference_files where id=p_file_id;
 perform public.log_event('MEETING_REFERENCE_FILE_REMOVED', 'meeting_reference_files', p_file_id, jsonb_build_object('meeting_id', v_file.meeting_id));
 return v_file.storage_path;
end;$$;

alter table public.meeting_references enable row level security;
alter table public.meeting_reference_files enable row level security;

create policy meeting_references_select on public.meeting_references
 for select to authenticated using (public.can_read_class(class_id));
create policy meeting_reference_files_select on public.meeting_reference_files
 for select to authenticated using (public.can_read_class(class_id));

revoke all on public.meeting_references, public.meeting_reference_files from anon;
revoke insert, update, delete on public.meeting_references, public.meeting_reference_files from authenticated;
grant select on public.meeting_references, public.meeting_reference_files to authenticated;

revoke all on function public.can_manage_meeting_reference(uuid) from public, anon;
revoke all on function public.save_meeting_reference(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.delete_meeting_reference(uuid) from public, anon;
revoke all on function public.attach_meeting_reference_file(uuid, text, text, text, bigint) from public, anon;
revoke all on function public.remove_meeting_reference_file(uuid) from public, anon;

grant execute on function public.can_manage_meeting_reference(uuid),
 public.save_meeting_reference(uuid, uuid, text, text, text, text),
 public.delete_meeting_reference(uuid),
 public.attach_meeting_reference_file(uuid, text, text, text, bigint),
 public.remove_meeting_reference_file(uuid) to authenticated;

-- Private storage bucket for meeting journal references (PDF, Word, ZIP/RAR/7z, slides, datasets, citations).
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
 'meeting-references',
 'meeting-references',
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
  'text/csv',
  'application/x-bibtex',
  'application/x-research-info-systems'
 ]
)
on conflict (id) do update set
 public=false,
 file_size_limit=52428800,
 allowed_mime_types=excluded.allowed_mime_types;

create policy meeting_ref_storage_read on storage.objects for select to authenticated using (
 bucket_id='meeting-references' and case when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.can_read_class(split_part(name,'/',1)::uuid) else false end
);
create policy meeting_ref_storage_upload on storage.objects for insert to authenticated with check (
 bucket_id='meeting-references' and case when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.can_manage_meeting_reference(split_part(name,'/',1)::uuid) else false end
);
create policy meeting_ref_storage_delete on storage.objects for delete to authenticated using (
 bucket_id='meeting-references' and case when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.can_manage_meeting_reference(split_part(name,'/',1)::uuid) else false end
);

commit;

