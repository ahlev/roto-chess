-- Realtime publication: the doorbell tables. postgres_changes respects RLS,
-- so participants-only read policies also gate the event stream — the
-- founder's GOING-LIVE checklist includes verifying this on the live
-- project (a non-participant subscriber must receive NO events, and a
-- team_only chat INSERT must not broadcast to the enemy team).
--
-- Guarded so the migration also runs on plain Postgres (tests, PGlite),
-- where the supabase_realtime publication does not exist.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table games;
    alter publication supabase_realtime add table game_players;
    alter publication supabase_realtime add table moves;
    alter publication supabase_realtime add table game_actions;
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;
