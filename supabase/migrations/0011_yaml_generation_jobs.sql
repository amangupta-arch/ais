-- Tracking table for the on-demand YAML generator (/yaml-generate +
-- /yaml-status). One row per (course_slug, lesson_slug, language). Updated
-- by the generate API route as it moves through running → done | failed.

create table if not exists yaml_generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  bundle_slug   text not null,
  course_slug   text not null,
  course_title  text not null,
  lesson_slug   text not null,
  lesson_title  text not null,
  lesson_index  integer not null,
  language      text not null,
  model         text,
  status        text not null check (status in ('queued','running','done','failed')),
  attempts      integer not null default 0,
  yaml_path     text,
  error         text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (course_slug, lesson_slug, language)
);

create index if not exists idx_yaml_jobs_status on yaml_generation_jobs (status);
create index if not exists idx_yaml_jobs_bundle on yaml_generation_jobs (bundle_slug);

-- Refresh updated_at on every row touch.
create or replace function set_yaml_jobs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_yaml_jobs_updated_at on yaml_generation_jobs;
create trigger trg_yaml_jobs_updated_at
  before update on yaml_generation_jobs
  for each row execute function set_yaml_jobs_updated_at();

-- RLS: read open to anon (so the public /yaml-status page can render
-- without auth, matching /database-schema). All writes go through the
-- service-role key from the API route, which bypasses RLS.
alter table yaml_generation_jobs enable row level security;

drop policy if exists "yaml_jobs_read_all" on yaml_generation_jobs;
create policy "yaml_jobs_read_all"
  on yaml_generation_jobs
  for select
  using (true);
