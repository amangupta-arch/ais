-- Specific state board when education_board = 'state'. India has
-- 30-odd boards (Maharashtra, UP, Tamil Nadu, …); the funnel's board
-- step shows them as a sub-picker, and we write the chosen one here.
-- Stays null for CBSE / ICSE / IB / Cambridge.

alter table profiles
  add column if not exists state_board text;

-- Slug guard, same shape as education_board.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_state_board_format_chk') then
    alter table profiles
      add constraint profiles_state_board_format_chk
      check (state_board is null or state_board ~ '^[a-z0-9-]{1,40}$');
  end if;
end $$;
