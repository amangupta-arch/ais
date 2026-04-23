create or replace function public.bump_streak(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  s record;
  today date := current_date;
begin
  select * into s from user_streaks where user_id = p_user_id for update;
  if s.last_active_date = today then
    return; -- already logged today
  elsif s.last_active_date = today - 1 then
    update user_streaks set
      current_streak = s.current_streak + 1,
      longest_streak = greatest(s.longest_streak, s.current_streak + 1),
      last_active_date = today
    where user_id = p_user_id;
  elsif s.freezes_available > 0 and s.last_active_date >= today - 3 then
    update user_streaks set
      freezes_available = s.freezes_available - 1,
      total_freezes_used = s.total_freezes_used + 1,
      last_active_date = today
    where user_id = p_user_id;
  else
    update user_streaks set
      current_streak = 1,
      last_active_date = today
    where user_id = p_user_id;
  end if;
end; $$;
