create table if not exists public.transport_complaint_authorities (
  id uuid primary key default gen_random_uuid(),
  city_name text not null unique,
  region_name text,
  authority_name text not null,
  endpoint_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transport_complaints
  add column if not exists city_name text,
  add column if not exists vehicle_plate text,
  add column if not exists evidence jsonb not null default '[]'::jsonb,
  add column if not exists routed_authority_name text,
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivered_at timestamptz;

alter table public.transport_complaint_authorities enable row level security;
drop policy if exists "public complaint authorities read" on public.transport_complaint_authorities;
create policy "public complaint authorities read" on public.transport_complaint_authorities
  for select to anon, authenticated using (active = true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('complaint-evidence','complaint-evidence',false,26214400,ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','video/quicktime','video/3gpp'])
on conflict (id) do update set public=false,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;

create index if not exists transport_complaints_city_idx on public.transport_complaints(city_name);
create index if not exists transport_complaints_plate_idx on public.transport_complaints(vehicle_plate);