-- Run in Supabase SQL Editor after the original app's NYC caption migrations.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  is_superadmin boolean not null default false
);
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists is_superadmin boolean not null default false;
alter table public.profiles enable row level security;

-- Existing accounts receive ordinary profiles; admin access is assigned manually.
insert into public.profiles (id, first_name, last_name)
select id, raw_user_meta_data ->> 'given_name', raw_user_meta_data ->> 'family_name'
from auth.users
on conflict (id) do nothing;

-- New Google accounts receive a profile automatically.
create or replace function public.create_admin_app_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, last_name, is_superadmin)
  values (new.id, new.raw_user_meta_data ->> 'given_name',
    new.raw_user_meta_data ->> 'family_name', false)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_admin_app_profile() from public, anon, authenticated;
drop trigger if exists admin_app_create_profile on auth.users;
create trigger admin_app_create_profile after insert on auth.users
for each row execute function public.create_admin_app_profile();

-- Only trusted database operators can assign admin privileges.
create or replace function public.protect_superadmin_flag()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if TG_OP = 'INSERT' then
      if new.is_superadmin then raise exception 'Cannot assign superadmin privileges'; end if;
    elsif new.is_superadmin is distinct from old.is_superadmin then
      raise exception 'Cannot change superadmin privileges';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_superadmin_flag on public.profiles;
create trigger protect_superadmin_flag before insert or update on public.profiles
for each row execute function public.protect_superadmin_flag();

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_superadmin = true
  );
$$;
revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "Admin: read own profile" on public.profiles;
create policy "Admin: read own profile" on public.profiles for select to authenticated
using (id = (select auth.uid()));
drop policy if exists "Admin: read all profiles" on public.profiles;
create policy "Admin: read all profiles" on public.profiles for select to authenticated
using ((select public.is_superadmin()));

grant select, insert, update, delete on public.nyc_caption_media to authenticated;
grant select on public.nyc_caption_votes to authenticated;
drop policy if exists "Admin: manage media" on public.nyc_caption_media;
create policy "Admin: manage media" on public.nyc_caption_media for all to authenticated
using ((select public.is_superadmin())) with check ((select public.is_superadmin()));
drop policy if exists "Admin: read votes" on public.nyc_caption_votes;
create policy "Admin: read votes" on public.nyc_caption_votes for select to authenticated
using ((select public.is_superadmin()));
commit;
