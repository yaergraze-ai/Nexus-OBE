-- Apply after 001 and 002. No passwords or secret keys are stored in this migration.
begin;
-- The identity number in the newest institutional instruction replaces the earlier PRD number.
-- Resolve the existing directory reference before updating; classes reference this column.
insert into public.lecturer_directory(identity_number,full_name)
values ('0421117105','DIAN NOVIANTI')
on conflict (identity_number) do update set full_name=excluded.full_name;
update public.classes set lecturer_identity_number='0421117105'
where lecturer_identity_number='0431117105';
-- Only remove old directory record if no longer referenced.
delete from public.lecturer_directory where identity_number='0431117105'
and not exists(select 1 from public.classes where lecturer_identity_number='0431117105');
-- Do not reassign auth account IDs. Existing lecturer profile numbers require manual review
-- to avoid taking over another person's authenticated account.

-- Profiles support user-edited display names, never client-edited email, role or identity number.
create or replace function public.profile_self_edit_guard() returns trigger
language plpgsql set search_path=public as $$
begin
 if auth.uid()=old.id and not public.has_role(array['admin','super_admin']::public.user_role[]) then
  if new.id is distinct from old.id or new.email is distinct from old.email
   or new.identity_number is distinct from old.identity_number or new.role is distinct from old.role
   or new.is_active is distinct from old.is_active or new.faculty is distinct from old.faculty
   or new.study_program is distinct from old.study_program
   or new.created_at is distinct from old.created_at then
    raise exception 'Only display name and avatar are editable';
  end if;
 end if;
 return new;
end;$$;
drop trigger if exists profile_self_guard on public.profiles;
create trigger profile_self_guard before update on public.profiles
for each row execute function public.profile_self_edit_guard();
-- Existing RLS on profile updates stays in effect; grant only own ID.
drop policy if exists profile_self_update on public.profiles;
create policy profile_self_update on public.profiles for update to authenticated
using (id=auth.uid()) with check (id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',false,500000,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=500000,allowed_mime_types=array['image/webp'];
create policy "avatar owner insert" on storage.objects for insert to authenticated
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar owner update" on storage.objects for update to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar owner read" on storage.objects for select to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
