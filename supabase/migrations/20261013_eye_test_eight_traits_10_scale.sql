-- RinkLens Eye Test v2: eight position-labeled traits graded 1-10.
-- The same database trait keys have F/D-specific labels in the UI.
-- Preserve one vote per user/season/player and reviewer_count >= 3 RLS.
-- Refuse silent transformation of any prior 1-5 votes.
DO $migration_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.community_eye_votes LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.community_eye_scores LIMIT 1) THEN
    RAISE EXCEPTION 'Eye Test votes already exist: manually plan scale conversion before applying 1-10 migration';
  END IF;
END $migration_guard$;

ALTER TABLE public.community_eye_votes
  DROP CONSTRAINT community_eye_votes_skating_check,
  DROP CONSTRAINT community_eye_votes_puck_check,
  DROP CONSTRAINT community_eye_votes_iq_check,
  DROP CONSTRAINT community_eye_votes_defense_check,
  DROP CONSTRAINT community_eye_votes_compete_check,
  DROP CONSTRAINT community_eye_votes_transition_check;

ALTER TABLE public.community_eye_votes
  ADD COLUMN shooting smallint NOT NULL,
  ADD COLUMN positioning smallint NOT NULL,
  ADD CONSTRAINT community_eye_votes_skating_check CHECK (skating BETWEEN 1 AND 10),
  ADD CONSTRAINT community_eye_votes_puck_check CHECK (puck BETWEEN 1 AND 10),
  ADD CONSTRAINT community_eye_votes_iq_check CHECK (iq BETWEEN 1 AND 10),
  ADD CONSTRAINT community_eye_votes_defense_check CHECK (defense BETWEEN 1 AND 10),
  ADD CONSTRAINT community_eye_votes_compete_check CHECK (compete BETWEEN 1 AND 10),
  ADD CONSTRAINT community_eye_votes_transition_check CHECK (transition BETWEEN 1 AND 10),
  ADD CONSTRAINT community_eye_votes_shooting_check CHECK (shooting BETWEEN 1 AND 10),
  ADD CONSTRAINT community_eye_votes_positioning_check CHECK (positioning BETWEEN 1 AND 10);

ALTER TABLE public.community_eye_scores
  DROP CONSTRAINT community_eye_scores_score_check;
ALTER TABLE public.community_eye_scores
  ADD COLUMN shooting numeric NOT NULL,
  ADD COLUMN positioning numeric NOT NULL,
  ADD CONSTRAINT community_eye_scores_score_check CHECK (score BETWEEN 10 AND 100);

CREATE OR REPLACE FUNCTION rinklens_private.refresh_community_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  season text;
  player text;
  tally record;
BEGIN
  IF tg_op = 'DELETE' THEN
    season := old.season_id;
    player := old.player_id;
  ELSE
    season := new.season_id;
    player := new.player_id;
  END IF;

  SELECT count(*)::integer AS voter_count,
    round(avg(skating)::numeric,2) AS skating,
    round(avg(puck)::numeric,2) AS puck,
    round(avg(iq)::numeric,2) AS iq,
    round(avg(defense)::numeric,2) AS defense,
    round(avg(compete)::numeric,2) AS compete,
    round(avg(transition)::numeric,2) AS transition,
    round(avg(shooting)::numeric,2) AS shooting,
    round(avg(positioning)::numeric,2) AS positioning,
    round(avg((skating+puck+iq+defense+compete+transition+shooting+positioning)::numeric / 8 * 10))::integer AS score,
    max(updated_at) AS latest_at
  INTO tally
  FROM public.community_eye_votes
  WHERE season_id = season AND player_id = player;

  IF tally.voter_count = 0 THEN
    DELETE FROM public.community_eye_scores
      WHERE season_id = season AND player_id = player;
  ELSE
    INSERT INTO public.community_eye_scores
      (season_id,player_id,reviewer_count,skating,puck,iq,defense,compete,transition,shooting,positioning,score,latest_at)
    VALUES
      (season,player,tally.voter_count,tally.skating,tally.puck,tally.iq,tally.defense,
       tally.compete,tally.transition,tally.shooting,tally.positioning,tally.score,tally.latest_at)
    ON CONFLICT (season_id,player_id) DO UPDATE SET
      reviewer_count=excluded.reviewer_count,
      skating=excluded.skating,
      puck=excluded.puck,
      iq=excluded.iq,
      defense=excluded.defense,
      compete=excluded.compete,
      transition=excluded.transition,
      shooting=excluded.shooting,
      positioning=excluded.positioning,
      score=excluded.score,
      latest_at=excluded.latest_at;
  END IF;
  RETURN null;
END $function$;

-- The original table allowed INSERT but had no authenticated UPDATE GRANT.
-- Permit trait-only updates; RLS and guard trigger still enforce ownership,
-- immutable vote identity and the 15-second anti-spam interval.
GRANT UPDATE (skating,puck,iq,defense,compete,transition,shooting,positioning)
ON public.community_eye_votes TO authenticated;
