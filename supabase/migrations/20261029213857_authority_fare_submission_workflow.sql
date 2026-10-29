create table if not exists public.authority_fare_submissions (
  id uuid primary key default gen_random_uuid(),
  authority_user_id uuid not null references auth.users(id) on delete cascade,
  authority_name text not null,
  region_code text not null,
  region_name text not null,
  service_type text not null check (service_type in ('bus','taxi','rail','other')),
  vehicle_category text,
  rate_per_km numeric,
  base_fare numeric,
  minimum_fare numeric,
  fixed_fare numeric,
  currency text not null default 'ETB',
  fare_scope text not null default 'regional' check (fare_scope in ('national','regional','city','area','route')),
  city_name text,
  area_name text,
  distance_min_km numeric,
  distance_max_km numeric,
  passenger_type text,
  notes text,
  source_document_url text,
  source_document_title text,
  source_reference text,
  effective_from timestamptz,
  effective_to timestamptz,
  status text not null default 'submitted' check (status in ('submitted','reviewing','approved','rejected','published','expired')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists authority_fare_submissions_status_idx
on public.authority_fare_submissions(status, region_code, service_type, effective_from desc);

create index if not exists authority_fare_submissions_user_idx
on public.authority_fare_submissions(authority_user_id, created_at desc);

alter table public.authority_fare_submissions enable row level security;

create policy "Public can read published authority fares"
on public.authority_fare_submissions for select to anon, authenticated
using (status = 'published');

create policy "Authorities can read their submissions"
on public.authority_fare_submissions for select to authenticated
using ((select auth.uid()) = authority_user_id and (auth.jwt() -> 'app_metadata' ->> 'role') = 'authority');

create policy "Reviewers can read all authority fares"
on public.authority_fare_submissions for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('reviewer','admin'));

create policy "Authorities can submit fares"
on public.authority_fare_submissions for insert to authenticated
with check (
  (select auth.uid()) = authority_user_id
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'authority'
  and region_code = (auth.jwt() -> 'app_metadata' ->> 'region_code')
  and status = 'submitted'
);

create policy "Authorities can revise submitted fares"
on public.authority_fare_submissions for update to authenticated
using (
  (select auth.uid()) = authority_user_id
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'authority'
  and status in ('submitted','rejected')
)
with check (
  (select auth.uid()) = authority_user_id
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'authority'
  and region_code = (auth.jwt() -> 'app_metadata' ->> 'region_code')
  and status = 'submitted'
);

create policy "Reviewers can review authority fares"
on public.authority_fare_submissions for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('reviewer','admin'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('reviewer','admin'));

create or replace function public.set_authority_fare_submission_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at = coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists authority_fare_submission_updated_at on public.authority_fare_submissions;
create trigger authority_fare_submission_updated_at
before update on public.authority_fare_submissions
for each row execute function public.set_authority_fare_submission_updated_at();
