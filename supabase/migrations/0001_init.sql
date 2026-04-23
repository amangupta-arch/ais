create extension if not exists "uuid-ossp";

-- PROFILES
create table profiles (
  id                         uuid primary key references auth.users(id) on delete cascade,
  email                      text,
  display_name               text,
  avatar_url                 text,
  primary_goal               text,
  current_level              text,
  role                       text,
  interests                  text[] default '{}',
  native_language            text default 'en',
  preferred_language         text default 'en',
  daily_goal_minutes         int  default 10,
  daily_reminder_time        time default '19:00',
  preferred_tutor_persona    text default 'nova',
  onboarding_completed_at    timestamptz,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

-- PLANS & SUBSCRIPTIONS
create table plans (
  id                    text primary key,
  name                  text not null,
  tagline               text,
  description           text,
  price_inr             int  not null default 0,
  price_usd             numeric(10,2) default 0,
  billing_period_days   int  not null default 30,
  streak_unlock_days    int  not null default 1,
  max_lessons_per_day   int  default 1,
  features              jsonb default '[]'::jsonb,
  is_active             boolean default true,
  sort_order            int default 0,
  created_at            timestamptz default now()
);

create table subscriptions (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid not null references profiles(id) on delete cascade,
  plan_id                  text not null references plans(id),
  status                   text not null default 'active',
  started_at               timestamptz default now(),
  expires_at               timestamptz,
  cancelled_at             timestamptz,
  provider                 text,
  provider_subscription_id text,
  created_at               timestamptz default now()
);
create index on subscriptions(user_id, status);

-- COURSES
create table courses (
  id                  uuid primary key default uuid_generate_v4(),
  slug                text unique not null,
  title               text not null,
  subtitle            text,
  description         text,
  category            text,
  tags                text[] default '{}',
  plan_tier           text not null default 'free',
  is_bonus_badge      boolean default false,
  emoji               text,
  cover_gradient      text,
  difficulty          text default 'beginner',
  estimated_minutes   int default 30,
  lesson_count        int default 0,
  order_index         int default 0,
  is_published        boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index on courses(plan_tier, is_published);
create index on courses(category);

-- LESSONS
create table lessons (
  id                  uuid primary key default uuid_generate_v4(),
  course_id           uuid not null references courses(id) on delete cascade,
  slug                text not null,
  title               text not null,
  subtitle            text,
  order_index         int not null default 0,
  estimated_minutes   int default 5,
  xp_reward           int default 20,
  format              text default 'ai_chat',
  is_published        boolean default true,
  created_at          timestamptz default now(),
  unique(course_id, slug)
);
create index on lessons(course_id, order_index);

-- LESSON TURNS
create table lesson_turns (
  id              uuid primary key default uuid_generate_v4(),
  lesson_id       uuid not null references lessons(id) on delete cascade,
  order_index     int not null,
  turn_type       text not null,
  content         jsonb not null,
  is_required     boolean default true,
  xp_reward       int default 0,
  created_at      timestamptz default now(),
  unique(lesson_id, order_index)
);
create index on lesson_turns(lesson_id, order_index);

-- PROGRESS
create table user_course_progress (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  course_id       uuid not null references courses(id) on delete cascade,
  status          text not null default 'not_started',
  progress_pct    int default 0,
  last_lesson_id  uuid references lessons(id),
  started_at      timestamptz,
  completed_at    timestamptz,
  updated_at      timestamptz default now(),
  unique(user_id, course_id)
);

create table user_lesson_progress (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references profiles(id) on delete cascade,
  lesson_id            uuid not null references lessons(id) on delete cascade,
  course_id            uuid not null references courses(id) on delete cascade,
  status               text not null default 'not_started',
  current_turn_index   int default 0,
  xp_earned            int default 0,
  time_spent_seconds   int default 0,
  started_at           timestamptz,
  completed_at         timestamptz,
  updated_at           timestamptz default now(),
  unique(user_id, lesson_id)
);
create index on user_lesson_progress(user_id, status);

-- STREAKS & XP
create table user_streaks (
  user_id              uuid primary key references profiles(id) on delete cascade,
  current_streak       int default 0,
  longest_streak       int default 0,
  last_active_date     date,
  freezes_available    int default 2,
  total_freezes_used   int default 0,
  streak_goal_days     int default 9,
  updated_at           timestamptz default now()
);

create table user_xp (
  user_id              uuid primary key references profiles(id) on delete cascade,
  total_xp             int default 0,
  weekly_xp            int default 0,
  week_started_at      date default current_date,
  level                int default 1,
  updated_at           timestamptz default now()
);

create table xp_events (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  xp_amount       int not null,
  source          text not null,
  reference_id    uuid,
  metadata        jsonb,
  created_at      timestamptz default now()
);
create index on xp_events(user_id, created_at desc);

-- ACHIEVEMENTS
create table achievements (
  id              text primary key,
  title           text not null,
  description     text,
  icon            text,
  category        text,
  xp_reward       int default 50,
  is_active       boolean default true
);

create table user_achievements (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references profiles(id) on delete cascade,
  achievement_id   text not null references achievements(id),
  earned_at        timestamptz default now(),
  unique(user_id, achievement_id)
);

-- LEAGUES
create table leagues (
  id                uuid primary key default uuid_generate_v4(),
  tier              text not null,
  week_starts_at    date not null,
  max_members       int default 30,
  created_at        timestamptz default now()
);

create table league_members (
  id                uuid primary key default uuid_generate_v4(),
  league_id         uuid not null references leagues(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  xp_this_week      int default 0,
  rank              int,
  unique(league_id, user_id)
);

-- ANALYTICS
create table onboarding_events (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete cascade,
  session_id   text,
  step         text not null,
  payload      jsonb,
  created_at   timestamptz default now()
);

-- RLS
alter table profiles             enable row level security;
alter table subscriptions        enable row level security;
alter table user_course_progress enable row level security;
alter table user_lesson_progress enable row level security;
alter table user_streaks         enable row level security;
alter table user_xp              enable row level security;
alter table xp_events            enable row level security;
alter table user_achievements    enable row level security;
alter table league_members       enable row level security;
alter table onboarding_events    enable row level security;
alter table plans           enable row level security;
alter table courses         enable row level security;
alter table lessons         enable row level security;
alter table lesson_turns    enable row level security;
alter table achievements    enable row level security;
alter table leagues         enable row level security;

create policy "profiles_self_all"     on profiles             for all using (auth.uid() = id);
create policy "subs_self_read"        on subscriptions        for select using (auth.uid() = user_id);
create policy "course_prog_self"      on user_course_progress for all using (auth.uid() = user_id);
create policy "lesson_prog_self"      on user_lesson_progress for all using (auth.uid() = user_id);
create policy "streaks_self"          on user_streaks         for all using (auth.uid() = user_id);
create policy "xp_self"               on user_xp              for all using (auth.uid() = user_id);
create policy "xp_events_self_read"   on xp_events            for select using (auth.uid() = user_id);
create policy "achievements_self"     on user_achievements    for all using (auth.uid() = user_id);
create policy "league_self"           on league_members       for all using (auth.uid() = user_id);
create policy "onboarding_self"       on onboarding_events    for all using (auth.uid() = user_id);

create policy "plans_read"         on plans         for select using (true);
create policy "courses_read"       on courses       for select using (is_published = true);
create policy "lessons_read"       on lessons       for select using (is_published = true);
create policy "turns_read"         on lesson_turns  for select using (true);
create policy "achievements_read"  on achievements  for select using (is_active = true);
create policy "leagues_read"       on leagues       for select using (true);

-- TRIGGERS
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_streaks  (user_id) values (new.id) on conflict do nothing;
  insert into public.user_xp       (user_id) values (new.id) on conflict do nothing;
  insert into public.subscriptions (user_id, plan_id) values (new.id, 'free') on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch      before update on profiles             for each row execute function touch_updated_at();
create trigger courses_touch       before update on courses              for each row execute function touch_updated_at();
create trigger ucp_touch           before update on user_course_progress for each row execute function touch_updated_at();
create trigger ulp_touch           before update on user_lesson_progress for each row execute function touch_updated_at();
create trigger streak_touch        before update on user_streaks         for each row execute function touch_updated_at();
create trigger xp_touch            before update on user_xp              for each row execute function touch_updated_at();

create or replace function public.recount_lessons()
returns trigger language plpgsql as $$
declare target_course uuid;
begin
  target_course := coalesce(new.course_id, old.course_id);
  update courses set lesson_count = (
    select count(*) from lessons where course_id = target_course and is_published = true
  ) where id = target_course;
  return null;
end $$;

create trigger lessons_recount
  after insert or update or delete on lessons
  for each row execute function recount_lessons();
