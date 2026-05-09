-- Lesson audio storage + per-turn manifest.
--
-- Storage: a public-read bucket `lesson-audio` holds mp3 files keyed by
--   <voice_id>/<sha256(voice_id|model|text)>.mp3
-- so the same line of text spoken by the same voice with the same model
-- is generated exactly once across the whole catalog (cache-by-content).
--
-- Tables:
--   lesson_audio_assets    one row per unique mp3 in the bucket
--   lesson_audio_manifest  one row per (lesson, language, turn, chunk)
--                          pointing into the asset cache so the player
--                          knows what to play and in what order.

-- ---------- Storage bucket ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('lesson-audio', 'lesson-audio', true, 5242880)
on conflict (id) do nothing;

-- Public buckets serve files openly via the storage API; no extra RLS
-- on storage.objects needed for read. Writes go through the service-
-- role key from the API route.

-- ---------- Asset cache ----------
create table if not exists lesson_audio_assets (
  id            uuid primary key default gen_random_uuid(),
  -- sha256 of `${voice_id}|${model}|${text}` — the cache key.
  hash          text not null unique,
  voice_id      text not null,
  model         text not null,
  text          text not null,
  bytes         integer not null,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_audio_assets_voice_model
  on lesson_audio_assets (voice_id, model);

-- ---------- Per-turn manifest ----------
create table if not exists lesson_audio_manifest (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references lessons(id) on delete cascade,
  language     text not null,
  turn_index   integer not null,
  chunk_index  integer not null,
  asset_id     uuid not null references lesson_audio_assets(id) on delete restrict,
  -- denormalized for debugging / reverse-lookup; matches asset.text.
  text         text not null,
  created_at   timestamptz not null default now(),
  unique (lesson_id, language, turn_index, chunk_index)
);
create index if not exists idx_audio_manifest_lesson_lang
  on lesson_audio_manifest (lesson_id, language);

-- ---------- RLS ----------
alter table lesson_audio_assets enable row level security;
alter table lesson_audio_manifest enable row level security;

drop policy if exists "audio_assets_read_all" on lesson_audio_assets;
create policy "audio_assets_read_all"
  on lesson_audio_assets for select using (true);

drop policy if exists "audio_manifest_read_all" on lesson_audio_manifest;
create policy "audio_manifest_read_all"
  on lesson_audio_manifest for select using (true);
