-- Adds the generated YAML text directly to the job row so the API can
-- preserve content even when the deployed environment (Vercel) refuses
-- the on-disk write. Read-only via the existing yaml_jobs_read_all
-- policy; writes still go through the service-role key.
alter table yaml_generation_jobs
  add column if not exists yaml_text text;
