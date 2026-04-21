-- TableShifts Supabase foundation schema
-- One shared database, many isolated Admin Account environments.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum (
    'admin_account',
    'payroll_admin',
    'employee',
    'team_leader',
    'department_manager',
    'company_manager'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.entry_type as enum (
    'normal',
    'overtime',
    'weekend',
    'holiday',
    'vacation',
    'medical',
    'special_event',
    'absence'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.leave_status as enum (
    'requested',
    'approved',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.admin_environments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Admin environment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  name text not null,
  logo_path text,
  entry_colors jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment_id, name)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  manager_user_id uuid references auth.users(id) on delete set null,
  team_leader_user_id uuid references auth.users(id) on delete set null,
  shift_hours numeric(5,2) not null default 8 check (shift_hours > 0 and shift_hours <= 24),
  work_days smallint[] not null default array[1,2,3,4,5],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  environment_id uuid references public.admin_environments(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.app_role not null default 'employee',
  identification_number text,
  position text,
  company_id uuid references public.companies(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  reports_to_user_id uuid references auth.users(id) on delete set null,
  team_leader_user_id uuid references auth.users(id) on delete set null,
  start_date date,
  end_date date,
  co_available numeric(6,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment_id, email)
);

create table if not exists public.payroll_company_access (
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  payroll_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (payroll_user_id, company_id)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  type public.entry_type not null check (type in ('vacation', 'medical', 'special_event')),
  start_date date not null,
  end_date date not null,
  notes text,
  status public.leave_status not null default 'requested',
  attachment_path text,
  generated_document_html text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  work_date date not null,
  type public.entry_type not null,
  hours numeric(5,2) not null default 0 check (hours >= 0 and hours <= 24),
  leave_request_id uuid references public.leave_requests(id) on delete set null,
  attachment_path text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_user_id, work_date)
);

create table if not exists public.national_holidays (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  country_code text not null,
  holiday_date date not null,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (environment_id, company_id, department_id, country_code, holiday_date, name)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.admin_environments(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.individual_tables (
  id uuid primary key default gen_random_uuid(),
  share_token text not null unique,
  table_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_environment on public.profiles(environment_id);
create index if not exists idx_companies_environment on public.companies(environment_id);
create index if not exists idx_departments_company on public.departments(company_id);
create index if not exists idx_entries_employee_date on public.timesheet_entries(employee_user_id, work_date);
create index if not exists idx_entries_environment_date on public.timesheet_entries(environment_id, work_date);
create index if not exists idx_leave_environment_status on public.leave_requests(environment_id, status);
create index if not exists idx_holidays_scope on public.national_holidays(environment_id, holiday_date);
create index if not exists idx_documents_environment on public.documents(environment_id);
create index if not exists idx_audit_environment_created on public.audit_logs(environment_id, created_at desc);
create index if not exists idx_individual_tables_share_token on public.individual_tables(share_token);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_environments_updated_at on public.admin_environments;
create trigger trg_admin_environments_updated_at before update on public.admin_environments
for each row execute function public.set_updated_at();

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_leave_requests_updated_at on public.leave_requests;
create trigger trg_leave_requests_updated_at before update on public.leave_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_timesheet_entries_updated_at on public.timesheet_entries;
create trigger trg_timesheet_entries_updated_at before update on public.timesheet_entries
for each row execute function public.set_updated_at();

drop trigger if exists trg_individual_tables_updated_at on public.individual_tables;
create trigger trg_individual_tables_updated_at before update on public.individual_tables
for each row execute function public.set_updated_at();

create or replace function public.current_environment_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.environment_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.can_access_company(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin_account'
        or p.company_id = target_company_id
        or exists (
          select 1
          from public.payroll_company_access a
          where a.payroll_user_id = p.id
            and a.company_id = target_company_id
        )
        or exists (
          select 1
          from public.companies c
          where c.id = target_company_id
            and c.created_by = p.id
        )
      )
  )
$$;

create or replace function public.handle_admin_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  env_id uuid;
  full_name text;
begin
  if coalesce(new.raw_user_meta_data->>'account_type', '') <> 'admin_account' then
    return new;
  end if;

  full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  insert into public.admin_environments (owner_user_id, name)
  values (new.id, coalesce(full_name, split_part(new.email, '@', 1)) || ' environment')
  returning id into env_id;

  insert into public.profiles (
    id,
    environment_id,
    email,
    full_name,
    role,
    identification_number,
    position,
    start_date,
    created_by
  )
  values (
    new.id,
    env_id,
    new.email,
    coalesce(full_name, split_part(new.email, '@', 1)),
    'admin_account',
    'ADMIN-' || left(replace(new.id::text, '-', ''), 8),
    'Admin Account',
    current_date,
    new.id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_table_shifts_admin on auth.users;
create trigger on_auth_user_created_table_shifts_admin
after insert on auth.users
for each row execute function public.handle_admin_signup();

alter table public.admin_environments enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.departments enable row level security;
alter table public.payroll_company_access enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.leave_requests enable row level security;
alter table public.national_holidays enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.individual_tables enable row level security;

drop policy if exists "environment owner can read own environment" on public.admin_environments;
create policy "environment owner can read own environment" on public.admin_environments
for select using (owner_user_id = auth.uid() or id = public.current_environment_id());

drop policy if exists "environment owner can manage own environment" on public.admin_environments;
create policy "environment owner can manage own environment" on public.admin_environments
for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists "profiles read same environment" on public.profiles;
create policy "profiles read same environment" on public.profiles
for select using (id = auth.uid() or environment_id = public.current_environment_id());

drop policy if exists "profiles manage same environment" on public.profiles;
create policy "profiles manage same environment" on public.profiles
for all using (
  (
    public.current_role() = 'admin_account'
    or (public.current_role() = 'payroll_admin' and role not in ('admin_account', 'payroll_admin'))
  )
  and environment_id = public.current_environment_id()
) with check (
  (
    public.current_role() = 'admin_account'
    or (public.current_role() = 'payroll_admin' and role not in ('admin_account', 'payroll_admin'))
  )
  and environment_id = public.current_environment_id()
);

drop policy if exists "companies read accessible" on public.companies;
create policy "companies read accessible" on public.companies
for select using (environment_id = public.current_environment_id() and public.can_access_company(id));

drop policy if exists "companies manage setup roles" on public.companies;
create policy "companies manage setup roles" on public.companies
for all using (
  environment_id = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
  and public.can_access_company(id)
) with check (
  environment_id = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
);

drop policy if exists "departments read accessible company" on public.departments;
create policy "departments read accessible company" on public.departments
for select using (environment_id = public.current_environment_id() and public.can_access_company(company_id));

drop policy if exists "departments manage setup roles" on public.departments;
create policy "departments manage setup roles" on public.departments
for all using (
  environment_id = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
  and public.can_access_company(company_id)
) with check (
  environment_id = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
  and public.can_access_company(company_id)
);

drop policy if exists "payroll access read same environment" on public.payroll_company_access;
create policy "payroll access read same environment" on public.payroll_company_access
for select using (environment_id = public.current_environment_id());

drop policy if exists "payroll access manage admin account" on public.payroll_company_access;
create policy "payroll access manage admin account" on public.payroll_company_access
for all using (environment_id = public.current_environment_id() and public.current_role() = 'admin_account')
with check (environment_id = public.current_environment_id() and public.current_role() = 'admin_account');

drop policy if exists "entries read accessible company" on public.timesheet_entries;
create policy "entries read accessible company" on public.timesheet_entries
for select using (
  environment_id = public.current_environment_id()
  and (employee_user_id = auth.uid() or public.can_access_company(company_id))
);

drop policy if exists "entries manage accessible company" on public.timesheet_entries;
create policy "entries manage accessible company" on public.timesheet_entries
for all using (
  environment_id = public.current_environment_id()
  and (employee_user_id = auth.uid() or public.can_access_company(company_id))
) with check (
  environment_id = public.current_environment_id()
  and (employee_user_id = auth.uid() or public.can_access_company(company_id))
);

drop policy if exists "leave read accessible" on public.leave_requests;
create policy "leave read accessible" on public.leave_requests
for select using (
  environment_id = public.current_environment_id()
  and (employee_user_id = auth.uid() or public.can_access_company(company_id))
);

drop policy if exists "leave manage accessible" on public.leave_requests;
create policy "leave manage accessible" on public.leave_requests
for all using (
  environment_id = public.current_environment_id()
  and (employee_user_id = auth.uid() or public.can_access_company(company_id))
) with check (
  environment_id = public.current_environment_id()
  and (employee_user_id = auth.uid() or public.can_access_company(company_id))
);

drop policy if exists "holidays read accessible" on public.national_holidays;
create policy "holidays read accessible" on public.national_holidays
for select using (
  environment_id = public.current_environment_id()
  and (company_id is null or public.can_access_company(company_id))
);

drop policy if exists "holidays manage setup roles" on public.national_holidays;
create policy "holidays manage setup roles" on public.national_holidays
for all using (
  environment_id = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
) with check (
  environment_id = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
);

drop policy if exists "documents read accessible" on public.documents;
create policy "documents read accessible" on public.documents
for select using (
  environment_id = public.current_environment_id()
  and (owner_user_id = auth.uid() or company_id is null or public.can_access_company(company_id))
);

drop policy if exists "documents manage accessible" on public.documents;
create policy "documents manage accessible" on public.documents
for all using (
  environment_id = public.current_environment_id()
  and (owner_user_id = auth.uid() or company_id is null or public.can_access_company(company_id))
) with check (
  environment_id = public.current_environment_id()
  and (owner_user_id = auth.uid() or company_id is null or public.can_access_company(company_id))
);

drop policy if exists "audit read same environment" on public.audit_logs;
create policy "audit read same environment" on public.audit_logs
for select using (environment_id = public.current_environment_id());

drop policy if exists "audit insert same environment" on public.audit_logs;
create policy "audit insert same environment" on public.audit_logs
for insert with check (environment_id = public.current_environment_id());

drop policy if exists "individual tables public link read" on public.individual_tables;
create policy "individual tables public link read" on public.individual_tables
for select using (false);

drop policy if exists "individual tables public link insert" on public.individual_tables;
create policy "individual tables public link insert" on public.individual_tables
for insert with check (false);

drop policy if exists "individual tables public link update" on public.individual_tables;
create policy "individual tables public link update" on public.individual_tables
for update using (false) with check (false);

create or replace function public.get_individual_table(token_value text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select table_data
  from public.individual_tables
  where share_token = token_value
  limit 1
$$;

create or replace function public.save_individual_table(token_value text, data_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.individual_tables (share_token, table_data)
  values (token_value, data_value)
  on conflict (share_token) do update
  set table_data = excluded.table_data,
      updated_at = now();
end;
$$;

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('leave-documents', 'leave-documents', false)
on conflict (id) do nothing;

drop policy if exists "company logos read same environment" on storage.objects;
create policy "company logos read same environment" on storage.objects
for select using (
  bucket_id = 'company-logos'
  and ((storage.foldername(name))[1])::uuid = public.current_environment_id()
);

drop policy if exists "company logos manage setup roles" on storage.objects;
create policy "company logos manage setup roles" on storage.objects
for all using (
  bucket_id = 'company-logos'
  and ((storage.foldername(name))[1])::uuid = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
) with check (
  bucket_id = 'company-logos'
  and ((storage.foldername(name))[1])::uuid = public.current_environment_id()
  and public.current_role() in ('admin_account', 'payroll_admin')
);

drop policy if exists "leave documents read same environment" on storage.objects;
create policy "leave documents read same environment" on storage.objects
for select using (
  bucket_id = 'leave-documents'
  and ((storage.foldername(name))[1])::uuid = public.current_environment_id()
);

drop policy if exists "leave documents manage same environment" on storage.objects;
create policy "leave documents manage same environment" on storage.objects
for all using (
  bucket_id = 'leave-documents'
  and ((storage.foldername(name))[1])::uuid = public.current_environment_id()
) with check (
  bucket_id = 'leave-documents'
  and ((storage.foldername(name))[1])::uuid = public.current_environment_id()
);
