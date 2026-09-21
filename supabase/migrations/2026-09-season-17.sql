-- Season 17 (2026) setup
-- Run this ONCE in the Supabase SQL Editor before the first episode.
-- It is wrapped in a transaction: if any step fails, nothing changes.
--
--   1. Brings the schema up to date (columns the app already relies on + the new picks deadline)
--   2. Archives last season's data into a private `archive` schema (not reachable from the app)
--   3. Clears last season's episodes, picks, results, scores and contestants (players are kept)
--   4. Seeds the 12 Series 17 bakers and opens Episode 1

BEGIN;

-- 1. Schema ---------------------------------------------------------------

ALTER TABLE players  ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE picks    ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS lock_at timestamptz;

-- Reject new or changed picks once an episode is locked or its deadline has passed.
-- (The app checks this too; this makes it hold even for a stale browser tab.)
CREATE OR REPLACE FUNCTION enforce_picks_open() RETURNS trigger AS $$
DECLARE
  ep episodes%ROWTYPE;
BEGIN
  SELECT * INTO ep FROM episodes WHERE id = NEW.episode_id;
  IF FOUND AND (ep.status <> 'open' OR (ep.lock_at IS NOT NULL AND now() >= ep.lock_at)) THEN
    RAISE EXCEPTION 'Picks are closed for this episode';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS picks_open_check ON picks;
CREATE TRIGGER picks_open_check
  BEFORE INSERT OR UPDATE ON picks
  FOR EACH ROW EXECUTE FUNCTION enforce_picks_open();

-- 2. Archive last season ----------------------------------------------------

CREATE SCHEMA IF NOT EXISTS archive;
CREATE TABLE IF NOT EXISTS archive.s2025_contestants AS SELECT * FROM contestants;
CREATE TABLE IF NOT EXISTS archive.s2025_episodes    AS SELECT * FROM episodes;
CREATE TABLE IF NOT EXISTS archive.s2025_picks       AS SELECT * FROM picks;
CREATE TABLE IF NOT EXISTS archive.s2025_results     AS SELECT * FROM results;
CREATE TABLE IF NOT EXISTS archive.s2025_scores      AS SELECT * FROM scores;
CREATE TABLE IF NOT EXISTS archive.s2025_players     AS SELECT id, name, color FROM players;

-- 3. Reset ------------------------------------------------------------------

DELETE FROM episodes;     -- cascades to picks, results, scores
DELETE FROM contestants;

-- One episode per week number from here on (prevents double-click duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS episodes_week_number_key ON episodes (week_number);

-- 4. Seed Series 17 -----------------------------------------------------------
-- Bakers per the Channel 4 press pack (first names, as Channel 4 bills them).
-- Photos: upload in Admin > Contestants.

INSERT INTO contestants (name) VALUES
  ('Clara'), ('Connie'), ('Danni'), ('Gabe'), ('Gary'), ('Mo'),
  ('Molly'), ('Moyin'), ('Nikki'), ('Shannon'), ('Tom'), ('Yannis');

-- Episode 1. "Cake Week" is widely reported but not yet on Channel 4's guide.
-- Set the picks deadline in Admin > Episodes (or uncomment and edit lock_at below).
INSERT INTO episodes (week_number, theme, status, winner_guess_points /*, lock_at */)
VALUES (1, 'Cake Week', 'open', 10 /*, '2026-09-25 19:00:00-04' */);

COMMIT;
