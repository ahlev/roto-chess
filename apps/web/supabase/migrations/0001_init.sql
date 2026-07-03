-- Roto Chess V1 — schema, RLS, and the referee's office.
-- The engine decides legality; Postgres decides ordering. Clients never
-- write game state: submit_turn/join_game are the only write paths for it,
-- and submit_turn is callable by the service role alone.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id                  uuid primary key references auth.users on delete cascade,
  username            citext unique,
  display_name        text,
  email_notifications boolean not null default true,
  reduced_motion      boolean not null default false,
  coach_enabled       boolean not null default true,
  vacation_until      timestamptz,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tables — the persistent social entity; games are episodes within it
-- ---------------------------------------------------------------------------
create table tables (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references profiles,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
create table games (
  id             uuid primary key default gen_random_uuid(),
  table_id       uuid not null references tables on delete cascade,
  game_no        int  not null default 1,          -- episode number in the series
  join_code      text unique not null,             -- 5 chars, unambiguous alphabet (display: ROTO-XXXXX)
  status         text not null default 'lobby'
                 check (status in ('lobby','active','complete','abandoned','dormant')),
  engine_version text not null,
  state          jsonb not null,                   -- current BoardState snapshot
  current_ply    int  not null default 0,
  active_seat    smallint,                         -- 1..4 while active, else null
  result         text check (result in ('team_13','team_24','draw')),
  result_reason  text check (result_reason in
                 ('checkmate','resignation','stalemate','threefold',
                  'fifty_move','agreement','abandonment')),
  reminder_sent_at timestamptz,                    -- day-7 abandonment reminder
  created_by     uuid references profiles,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_move_at   timestamptz,
  check (char_length(join_code) = 5)
);
create index games_table_idx on games (table_id, game_no);
create index games_active_seat_idx on games (active_seat) where status = 'active';

-- ---------------------------------------------------------------------------
-- game_players — seats; team = seat parity (§1.1), never configurable
-- ---------------------------------------------------------------------------
create table game_players (
  game_id       uuid not null references games on delete cascade,
  seat          smallint not null check (seat between 1 and 4),
  user_id       uuid not null references profiles,
  team          smallint generated always as (((seat - 1) % 2) + 1) stored,
  ready         boolean not null default false,
  last_seen_ply int not null default 0,            -- catch-up replay anchor
  joined_at     timestamptz not null default now(),
  primary key (game_id, seat),
  unique (game_id, user_id)
);
create index game_players_user_idx on game_players (user_id);

-- ---------------------------------------------------------------------------
-- moves — append-only source of truth; UNIQUE(game_id, ply) is the
-- concurrency backstop behind submit_turn's optimistic lock
-- ---------------------------------------------------------------------------
create table moves (
  id         bigint generated always as identity primary key,
  game_id    uuid not null references games on delete cascade,
  ply        int not null,                          -- 1-based turn number
  seat       smallint not null,
  turn       jsonb not null,                        -- { submoves: [Move] | [Move, Move] }
  notation   text not null,                         -- canonical Roto-PGN token
  created_at timestamptz not null default now(),
  unique (game_id, ply)
);

-- ---------------------------------------------------------------------------
-- game_actions — resign / draw / abandonment / nudge machinery
-- ---------------------------------------------------------------------------
create table game_actions (
  id         bigint generated always as identity primary key,
  game_id    uuid not null references games on delete cascade,
  user_id    uuid not null references profiles,
  kind       text not null check (kind in
             ('resign_propose','resign_confirm','resign_decline',
              'draw_propose','draw_accept','draw_decline','draw_claim',
              'abandon_claim','abandon_agree','abandon_object','nudge')),
  ply_at     int not null,                          -- proposals void when current_ply passes this
  created_at timestamptz not null default now()
);
create index game_actions_game_idx on game_actions (game_id, created_at);

-- ---------------------------------------------------------------------------
-- chat_messages — one channel per TABLE, persistent across the series;
-- optional move anchor threads a message onto a specific game ply.
-- team_only is reserved for a future house-rule setting (V1 always false).
-- ---------------------------------------------------------------------------
create table chat_messages (
  id          bigint generated always as identity primary key,
  table_id    uuid not null references tables on delete cascade,
  game_id     uuid references games on delete cascade,
  anchor_ply  int,
  user_id     uuid not null references profiles,
  team_only   boolean not null default false,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index chat_table_idx on chat_messages (table_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger games_touch before update on games
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer so policies stay one-liner and index-friendly)
-- ---------------------------------------------------------------------------
create or replace function is_game_participant(p_game_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = auth.uid()
  );
$$;

create or replace function is_table_participant(p_table_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1
    from game_players gp
    join games g on g.id = gp.game_id
    where g.table_id = p_table_id and gp.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — clients read; only the server (service role) writes game state
-- ---------------------------------------------------------------------------
alter table profiles      enable row level security;
alter table tables        enable row level security;
alter table games         enable row level security;
alter table game_players  enable row level security;
alter table moves         enable row level security;
alter table game_actions  enable row level security;
alter table chat_messages enable row level security;

create policy profiles_select on profiles
  for select to authenticated using (true);
create policy profiles_update_own on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on profiles
  for insert to authenticated with check (id = auth.uid());

create policy tables_select on tables
  for select to authenticated using (is_table_participant(id));

create policy games_select on games
  for select to authenticated using (is_game_participant(id));
-- No INSERT/UPDATE/DELETE policies on games: creation and turns go through
-- server routes; joining goes through the join_game RPC.

create policy game_players_select on game_players
  for select to authenticated using (is_game_participant(game_id));

create policy moves_select on moves
  for select to authenticated using (is_game_participant(game_id));
-- No client INSERT into moves, ever.

create policy game_actions_select on game_actions
  for select to authenticated using (is_game_participant(game_id));
create policy game_actions_propose on game_actions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_game_participant(game_id)
    and kind in ('resign_propose','resign_confirm','resign_decline',
                 'draw_propose','draw_accept','draw_decline','draw_claim',
                 'abandon_claim','abandon_agree','abandon_object','nudge')
  );
-- Resolution (actually ending a game) is server-side only.

create policy chat_select on chat_messages
  for select to authenticated
  using (
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
  );
create policy chat_insert on chat_messages
  for insert to authenticated
  with check (user_id = auth.uid() and is_table_participant(table_id));

-- ---------------------------------------------------------------------------
-- submit_turn — the single serialization point. The route handler has
-- already validated the turn with the engine; this function's job is
-- atomicity: optimistic current_ply lock + UNIQUE(game_id, ply) backstop.
-- Any pending proposals are voided in the same transaction.
-- ---------------------------------------------------------------------------
create or replace function submit_turn(
  p_game_id uuid, p_expected_ply int, p_seat smallint,
  p_turn jsonb, p_notation text, p_new_state jsonb,
  p_new_active_seat smallint, p_new_status text,
  p_result text, p_result_reason text
) returns void language plpgsql security definer
set search_path = public as $$
begin
  update games
     set state         = p_new_state,
         current_ply   = p_expected_ply + 1,
         active_seat   = p_new_active_seat,
         status        = p_new_status,
         result        = p_result,
         result_reason = p_result_reason,
         last_move_at  = now()
   where id = p_game_id
     and current_ply = p_expected_ply          -- optimistic lock
     and status = 'active';
  if not found then
    raise exception 'TURN_CONFLICT';
  end if;

  insert into moves (game_id, ply, seat, turn, notation)
  values (p_game_id, p_expected_ply + 1, p_seat, p_turn, p_notation);

  -- A completed turn voids pending proposals (standard chess convention).
  delete from game_actions
   where game_id = p_game_id
     and kind in ('resign_propose','draw_propose','draw_accept')
     and ply_at < p_expected_ply + 1;
end $$;

revoke execute on function submit_turn from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- join_game — seat claiming without check-then-insert races
-- ---------------------------------------------------------------------------
create or replace function join_game(p_code text, p_seat smallint)
returns uuid language plpgsql security definer
set search_path = public as $$
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

  select * into v_game from games where join_code = upper(p_code);
  if not found or v_game.status <> 'lobby' then
    raise exception 'GAME_NOT_JOINABLE';
  end if;

  insert into game_players (game_id, seat, user_id)
  values (v_game.id, p_seat, auth.uid())
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'SEAT_TAKEN_OR_ALREADY_SEATED';
  end if;

  -- Fourth seat fills → the game goes live; seat 1 opens (engine initial).
  if (select count(*) from game_players where game_id = v_game.id) = 4 then
    update games
       set status = 'active', active_seat = 1, last_move_at = now()
     where id = v_game.id and status = 'lobby';
  end if;

  return v_game.id;
end $$;

grant execute on function join_game to authenticated;
