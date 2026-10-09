-- Run once in your Supabase project's SQL Editor.
-- Each signed-in user can read and edit ONLY their own scouting reports/watchlist.
create table if not exists public.scouting_reports (
    user_id uuid not null references auth.users(id) on delete cascade,
    season_id text not null check (season_id ~ '^[0-9]{8}$'),
    player_id text not null,
    skating smallint not null check (skating between 1 and 5),
    puck smallint not null check (puck between 1 and 5),
    iq smallint not null check (iq between 1 and 5),
    defense smallint not null check (defense between 1 and 5),
    compete smallint not null check (compete between 1 and 5),
    transition smallint not null check (transition between 1 and 5),
    notes text not null default '' check (length(notes) <= 4000),
    updated_at timestamptz not null default now(),
    primary key(user_id, season_id, player_id)
);
create table if not exists public.watchlist (
    user_id uuid not null references auth.users(id) on delete cascade,
    season_id text not null check (season_id ~ '^[0-9]{8}$'),
    player_id text not null,
    created_at timestamptz not null default now(),
    primary key(user_id, season_id, player_id)
);
alter table public.scouting_reports enable row level security;
alter table public.watchlist enable row level security;
revoke all on public.scouting_reports from anon, authenticated;
revoke all on public.watchlist from anon, authenticated;
grant select, insert, update, delete on public.scouting_reports to authenticated;
grant select, insert, update, delete on public.watchlist to authenticated;

drop policy if exists "Read own scouting reports" on public.scouting_reports;
create policy "Read own scouting reports" on public.scouting_reports
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Create own scouting reports" on public.scouting_reports;
create policy "Create own scouting reports" on public.scouting_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own scouting reports" on public.scouting_reports;
create policy "Update own scouting reports" on public.scouting_reports
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own scouting reports" on public.scouting_reports;
create policy "Delete own scouting reports" on public.scouting_reports
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read own watchlist" on public.watchlist;
create policy "Read own watchlist" on public.watchlist
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Create own watchlist" on public.watchlist;
create policy "Create own watchlist" on public.watchlist
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own watchlist" on public.watchlist;
create policy "Delete own watchlist" on public.watchlist
  for delete to authenticated using ((select auth.uid()) = user_id);