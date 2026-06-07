-- Serialize concurrent rate_limit_check() calls per (scope, key).
--
-- Under PostgreSQL's default READ COMMITTED isolation, two parallel
-- RPC calls from the same IP could both observe count < p_max and
-- each INSERT a row — a parallel burst could blow well past the
-- 30/hour cap on /api/ai/math-quiz, defeating the point of the
-- limiter.
--
-- Take a per-(scope, key) advisory lock at xact level: callers
-- contending on the same key block on each other and serialize.
-- The lock is released automatically on commit (end of the RPC),
-- so there's no manual cleanup path.
--
-- Hash collision between distinct keys would cause spurious
-- serialization on those pairs but never an under-count, so it's
-- safe to use the two-int form (no collision-handling needed).

create or replace function public.rate_limit_check(
  p_scope text,
  p_key text,
  p_window_sec int,
  p_max int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Serialize per (scope, key). Released on commit (end of RPC).
  perform pg_advisory_xact_lock(hashtext(p_scope), hashtext(p_key));

  delete from public.rate_limits
   where scope = p_scope
     and ts < now() - make_interval(secs => p_window_sec * 2);

  select count(*) into v_count
    from public.rate_limits
   where scope = p_scope
     and key = p_key
     and ts >= now() - make_interval(secs => p_window_sec);

  if v_count >= p_max then
    return p_window_sec;
  end if;

  insert into public.rate_limits (scope, key) values (p_scope, p_key);
  return 0;
end;
$$;
