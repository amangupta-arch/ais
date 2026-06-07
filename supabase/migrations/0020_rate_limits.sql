-- Per-scope, per-key rolling-window rate limiting. Backs the
-- checkRateLimit() helper in lib/rate-limit.ts, which gates
-- /api/ai/math-quiz (and any other public LLM route) so a bot
-- can't anonymously rack up an unbounded Anthropic bill.
--
-- Schema is deliberately tiny: one row per allowed call, indexed
-- on (scope, key, ts). The RPC below counts rows in the window,
-- deletes very old rows opportunistically, and inserts a new row
-- iff under cap. One round-trip per request.
--
-- No RLS policies are added: nothing other than the service-role
-- client touches this table. RLS is enabled so anon/auth roles
-- get default-deny.

create table if not exists public.rate_limits (
  scope text not null,
  key text not null,
  ts timestamptz not null default now()
);

create index if not exists rate_limits_lookup
  on public.rate_limits (scope, key, ts desc);

alter table public.rate_limits enable row level security;

-- Atomic check-and-record. Returns 0 if the call is allowed
-- (a row is inserted), otherwise returns the suggested
-- Retry-After in seconds (= window length).
--
-- security definer so even a future caller using the anon role
-- (we don't today, but for safety) can't read or write rows
-- outside this contract.
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
  -- Opportunistic cleanup so the table stays bounded. We delete
  -- anything older than 2x window for this scope on every call.
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

revoke all on function public.rate_limit_check(text, text, int, int) from public;
grant execute on function public.rate_limit_check(text, text, int, int) to service_role;
