-- NEXUS OBE v2.4: pending self-registration table for verified email OTP signup.
-- Apply AFTER 001..005.
begin;

create table if not exists public.pending_signups (
 email text primary key check (email = lower(trim(email)) and email like '%@%'),
 identity_number varchar(30) not null,
 full_name varchar(150) not null,
 otp_hash text not null,
 attempts integer not null default 0,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);

alter table public.pending_signups enable row level security;
revoke all on public.pending_signups from public, anon, authenticated;

commit;
