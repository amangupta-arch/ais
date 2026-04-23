-- Atomic XP increment. Safe under concurrent calls: the INSERT ... ON CONFLICT
-- DO UPDATE ... acquires a row-level lock, so `total_xp + p_xp` is evaluated
-- against the latest committed row every time. The previous read-modify-write
-- path in actions.ts could lose updates when the client fired two advanceTurn
-- calls without awaiting.
create or replace function public.add_xp(p_user_id uuid, p_xp int)
returns void language plpgsql security definer as $$
declare
  today date := current_date;
begin
  if p_xp <= 0 then
    return;
  end if;

  insert into user_xp (user_id, total_xp, weekly_xp, week_started_at, level, updated_at)
  values (p_user_id, p_xp, p_xp, today, 1, now())
  on conflict (user_id) do update set
    total_xp = user_xp.total_xp + p_xp,
    weekly_xp = case
      when user_xp.week_started_at >= today - 6
        then user_xp.weekly_xp + p_xp
      else p_xp
    end,
    week_started_at = case
      when user_xp.week_started_at >= today - 6
        then user_xp.week_started_at
      else today
    end,
    updated_at = now();
end; $$;
