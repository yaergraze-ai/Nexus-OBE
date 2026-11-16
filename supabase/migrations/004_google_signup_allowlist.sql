-- NEXUS OBE v2.2. Restrict creation of Supabase Auth accounts to email invites.
-- Apply AFTER 001, 002, seed, 003. Configure the hook manually in Authentication > Hooks.
begin;
create table if not exists public.account_allowlist (
 email text primary key check(email=lower(trim(email)) and email like '%@%'),
 approved_at timestamptz not null default now()
);
alter table public.account_allowlist enable row level security;
-- There are deliberately no authenticated or anonymous RLS policies on this table.
revoke all on public.account_allowlist from public,anon,authenticated;
-- Existing approved accounts are grandfathered in; this never creates an auth user.
insert into public.account_allowlist(email)
select lower(trim(email)) from public.profiles where email is not null
on conflict do nothing;
create or replace function public.hook_campus_invite_only(event jsonb)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 v_email text := lower(trim(coalesce(event->'user'->>'email','')));
 v_provider text := coalesce(event->'user'->'app_metadata'->>'provider','');
begin
 -- Google can link to an existing verified email account, but may not create
 -- a second standalone Auth account. Supabase's identity-linking flow does
 -- not create a user and therefore does not trigger this hook.
 if v_provider <> 'email' or not exists(
   select 1 from public.account_allowlist a where a.email=v_email
 ) then
   return jsonb_build_object('error',jsonb_build_object(
    'http_code',403,'message','Akun harus diundang oleh admin kampus terlebih dahulu.'
   ));
 end if;
 return '{}'::jsonb;
end;
$$;
revoke all on function public.hook_campus_invite_only(jsonb) from public,anon,authenticated;
grant execute on function public.hook_campus_invite_only(jsonb) to supabase_auth_admin;
commit;
