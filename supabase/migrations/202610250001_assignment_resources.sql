-- Apply after 202610190001_admin_access.sql. Existing assignment tables are preserved.
begin;

create table if not exists public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.llm_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_id uuid not null references public.llm_providers(id),
  created_at timestamptz not null default now()
);
create table if not exists public.prompt_chains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid not null references public.prompt_chains(id),
  step_order integer not null check (step_order >= 0),
  system_prompt text,
  user_prompt text not null,
  llm_model_id uuid references public.llm_models(id),
  unique (prompt_chain_id, step_order)
);
create table if not exists public.prompt_chain_mix (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid not null references public.prompt_chains(id),
  weight numeric not null default 1 check (weight >= 0),
  is_active boolean not null default true
);
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  definition text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  prompt_chain_id uuid references public.prompt_chains(id),
  prompt text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table if not exists public.ai_generation_examples (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  response text not null,
  llm_model_id uuid references public.llm_models(id),
  created_at timestamptz not null default now()
);
create table if not exists public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  generation_request_id uuid references public.generation_requests(id),
  llm_model_id uuid references public.llm_models(id),
  response text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.allowed_signup_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain = lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.whitelisted_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  created_at timestamptz not null default now()
);

-- Each resource gets only the operations required by the assignment.
-- Other applications' existing RLS policies are left intact.
do $$
declare t text; seq_name text;
begin
  foreach t in array array['prompt_chains', 'prompt_chain_steps', 'prompt_chain_mix',
    'terms', 'generation_requests', 'ai_generation_examples', 'llm_models',
    'llm_providers', 'llm_responses', 'allowed_signup_domains', 'whitelisted_emails']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "Assignment admin read" on public.%I', t);
    execute format('create policy "Assignment admin read" on public.%I for select to authenticated using ((select public.is_superadmin()))', t);
    if t not in ('prompt_chains', 'prompt_chain_steps', 'generation_requests', 'llm_responses') then
      execute format('grant update on public.%I to authenticated', t);
      execute format('drop policy if exists "Assignment admin update" on public.%I', t);
      execute format('create policy "Assignment admin update" on public.%I for update to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t);
      if t <> 'prompt_chain_mix' then
        execute format('grant insert, delete on public.%I to authenticated', t);
        -- Existing tables may use serial/identity keys instead of UUID defaults.
        for seq_name in
          select pg_catalog.pg_get_serial_sequence(format('public.%I', t), a.attname)
          from pg_catalog.pg_attribute a
          where a.attrelid = pg_catalog.to_regclass(format('public.%I', t)) and a.attnum > 0 and not a.attisdropped
        loop
          if seq_name is not null then
            execute format('grant usage on sequence %s to authenticated', seq_name);
          end if;
        end loop;
        execute format('drop policy if exists "Assignment admin insert" on public.%I', t);
        execute format('create policy "Assignment admin insert" on public.%I for insert to authenticated with check ((select public.is_superadmin()))', t);
        execute format('drop policy if exists "Assignment admin delete" on public.%I', t);
        execute format('create policy "Assignment admin delete" on public.%I for delete to authenticated using ((select public.is_superadmin()))', t);
      end if;
    end if;
  end loop;
end;
$$;

-- Return metadata only, never arbitrary SQL or table data. Server actions also
-- authorize every request and enforce their own resource/operation allowlist.
create or replace function public.admin_resource_columns(resource_table text)
returns table (name text, type text, required boolean, has_default boolean, primary_key boolean, generated boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.is_superadmin(), false) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if resource_table not in ('prompt_chains', 'prompt_chain_steps', 'prompt_chain_mix',
    'terms', 'generation_requests', 'ai_generation_examples', 'llm_models',
    'llm_providers', 'llm_responses', 'allowed_signup_domains', 'whitelisted_emails') then
    raise exception 'Unsupported resource';
  end if;
  return query
    select a.attname::text, t.typname::text, a.attnotnull,
      (a.atthasdef or a.attidentity <> ''),
      exists (select 1 from pg_catalog.pg_index i where i.indrelid = c.oid and i.indisprimary and a.attnum = any(i.indkey)),
      (a.attgenerated <> '' or a.attidentity <> '')
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_type t on t.oid = a.atttypid
    where n.nspname = 'public' and c.relname = resource_table
      and a.attnum > 0 and not a.attisdropped
    order by a.attnum;
end;
$$;
revoke all on function public.admin_resource_columns(text) from public, anon;
grant execute on function public.admin_resource_columns(text) to authenticated;

-- Admins can preview private existing photos using short-lived signed URLs.
drop policy if exists "Admin: read caption photos" on storage.objects;
create policy "Admin: read caption photos" on storage.objects for select to authenticated
using (bucket_id = 'nyc-caption-photos' and (select public.is_superadmin()));
commit;
