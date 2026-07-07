-- ---------------------------------------------------------------------------
-- Observers (spectators) — table-scoped membership. An observer follows the
-- TABLE's whole series (rematches included) until they stop watching or
-- claim a seat. Read access rides the same RLS helpers pattern as players;
-- realtime respects RLS, so observers get live doorbells for free.
-- ---------------------------------------------------------------------------
create table table_observers (
  table_id   uuid not null references tables(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (table_id, user_id)
);
create index table_observers_user_idx on table_observers (user_id);

alter table table_observers enable row level security;

create or replace function is_table_observer(p_table_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from table_observers
    where table_id = p_table_id and user_id = auth.uid()
  );
$$;

create or replace function is_game_observer(p_game_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from table_observers o
    join games g on g.table_id = o.table_id
    where g.id = p_game_id and o.user_id = auth.uid()
  );
$$;

-- Players and fellow observers can see who's watching; only you can leave.
-- No client INSERT/UPDATE — joining goes through join_table_observer.
create policy table_observers_select on table_observers
  for select to authenticated
  using (is_table_participant(table_id) or is_table_observer(table_id));
create policy table_observers_delete_own on table_observers
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Extend the read policies: everything a participant may watch, an observer
-- may watch — EXCEPT team_only chat, which stays strictly inside the team.
-- ---------------------------------------------------------------------------
drop policy tables_select on tables;
create policy tables_select on tables
  for select to authenticated
  using (is_table_participant(id) or is_table_observer(id));

drop policy games_select on games;
create policy games_select on games
  for select to authenticated
  using (is_game_participant(id) or is_game_observer(id));

drop policy game_players_select on game_players;
create policy game_players_select on game_players
  for select to authenticated
  using (is_game_participant(game_id) or is_game_observer(game_id));

drop policy moves_select on moves;
create policy moves_select on moves
  for select to authenticated
  using (is_game_participant(game_id) or is_game_observer(game_id));

drop policy game_actions_select on game_actions;
create policy game_actions_select on game_actions
  for select to authenticated
  using (is_game_participant(game_id) or is_game_observer(game_id));
-- game_actions_propose is untouched: observers cannot act, only watch.

drop policy chat_select on chat_messages;
create policy chat_select on chat_messages
  for select to authenticated
  using (
    (
      is_table_participant(table_id)
      and (
        not team_only
        or exists (
          -- Team scoping is judged in the game the message anchors to (seats
          -- can rotate between games in a series). A specific leak test in CI
          -- guards this policy.
          select 1
          from game_players me
          join game_players sender
            on sender.game_id = me.game_id and sender.user_id = chat_messages.user_id
          where me.game_id = chat_messages.game_id
            and me.user_id = auth.uid()
            and me.team = sender.team
        )
      )
    )
    -- Observers hear the table, never the partners' line.
    or (is_table_observer(table_id) and not team_only)
  );

drop policy chat_insert on chat_messages;
create policy chat_insert on chat_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      is_table_participant(table_id)
      or (is_table_observer(table_id) and not team_only)
    )
    -- A move anchor must reference a game of THIS table (thread integrity;
    -- also keeps team_only routing inside the right seat map).
    and (
      game_id is null
      or exists (
        select 1 from games g
        where g.id = game_id and g.table_id = chat_messages.table_id
      )
    )
  );

-- Profiles: players and observers of the same table see each other's names
-- (both directions), and observers see fellow observers. The enumeration
-- guard stands — strangers still resolve nothing.
drop policy profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from game_players me
      join game_players them on them.game_id = me.game_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
    or exists (
      select 1
      from table_observers o
      join games g on g.table_id = o.table_id
      join game_players gp on gp.game_id = g.id
      where (o.user_id = auth.uid() and gp.user_id = profiles.id)
         or (gp.user_id = auth.uid() and o.user_id = profiles.id)
    )
    or exists (
      select 1
      from table_observers me
      join table_observers them on them.table_id = me.table_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- join_table_observer — spectate via the same unguessable code. Watchable
-- while the game is forming or live; a seated player just gets the game id.
-- ---------------------------------------------------------------------------
create or replace function join_table_observer(p_code text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_game games%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- FOR UPDATE serializes concurrent watcher joins on the same game row (the
  -- same single-row lock join_game takes — consistent ordering, no deadlock),
  -- so the 20-observer cap below is a hard bound, not a best effort.
  select * into v_game from games where join_code = upper(p_code) for update;
  if not found or v_game.status not in ('lobby', 'active') then
    raise exception 'GAME_NOT_WATCHABLE';
  end if;

  -- Players never double as observers — hand back the game.
  if exists (
    select 1 from game_players
    where game_id = v_game.id and user_id = auth.uid()
  ) then
    return v_game.id;
  end if;

  -- Sanity cap; idempotent re-joins pass through.
  if not exists (
    select 1 from table_observers
    where table_id = v_game.table_id and user_id = auth.uid()
  ) and (
    select count(*) from table_observers where table_id = v_game.table_id
  ) >= 20 then
    raise exception 'TABLE_FULL_OBSERVERS';
  end if;

  insert into table_observers (table_id, user_id)
  values (v_game.table_id, auth.uid())
  on conflict do nothing;

  return v_game.id;
end $$;

grant execute on function join_table_observer to authenticated;

-- ---------------------------------------------------------------------------
-- join_game — unchanged except: claiming a seat converts an observer into a
-- player atomically (delete the observer row in the same transaction).
-- ---------------------------------------------------------------------------
create or replace function join_game(p_code text, p_seat smallint)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_game games%rowtype;
  v_inserted int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_seat is null or p_seat < 1 or p_seat > 4 then
    raise exception 'BAD_SEAT';
  end if;

  -- FOR UPDATE serializes concurrent joiners of the same game: without it,
  -- seats 3 and 4 landing simultaneously can each count three players and
  -- neither activates — a permanent lobby wedge.
  select * into v_game from games where join_code = upper(p_code) for update;
  if not found or v_game.status <> 'lobby' then
    raise exception 'GAME_NOT_JOINABLE';
  end if;

  -- Idempotent for a user who is already seated (second tab, double-tap):
  -- just hand back the game instead of a misleading SEAT_TAKEN.
  if exists (
    select 1 from game_players
    where game_id = v_game.id and user_id = auth.uid()
  ) then
    return v_game.id;
  end if;

  insert into game_players (game_id, seat, user_id)
  values (v_game.id, p_seat, auth.uid())
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'SEAT_TAKEN';
  end if;

  -- An observer who takes a seat is a player now — one transaction, no limbo.
  delete from table_observers
   where table_id = v_game.table_id and user_id = auth.uid();

  -- Fourth seat fills → the game goes live; seat 1 opens (engine initial).
  if (select count(*) from game_players where game_id = v_game.id) = 4 then
    update games
       set status = 'active', active_seat = 1, last_move_at = now()
     where id = v_game.id and status = 'lobby';
  end if;

  return v_game.id;
end $$;

grant execute on function join_game to authenticated;

-- Realtime doorbell for the observers row (guarded: the publication does not
-- exist on plain Postgres/PGlite).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table table_observers;
  end if;
end $$;
