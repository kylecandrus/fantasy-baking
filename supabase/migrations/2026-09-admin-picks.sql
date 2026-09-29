-- Commissioner override for picks
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run; it touches no data.
--
-- The picks_open_check trigger rejects any pick written after an episode locks or its
-- deadline passes. That's right for players, but it also stops the commissioner from
-- entering picks someone sent in by text. This adds one deliberate way through:
-- Admin > Player picks saves via admin_set_picks(), which lifts the check for that
-- single call only.

BEGIN;

CREATE OR REPLACE FUNCTION enforce_picks_open() RETURNS trigger AS $$
DECLARE
  ep episodes%ROWTYPE;
BEGIN
  -- Set only inside admin_set_picks(), and only until that transaction ends.
  IF current_setting('fantasy.admin_override', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ep FROM episodes WHERE id = NEW.episode_id;
  IF FOUND AND (ep.status <> 'open' OR (ep.lock_at IS NOT NULL AND now() >= ep.lock_at)) THEN
    RAISE EXCEPTION 'Picks are closed for this episode';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replaces one player's picks for one episode, whatever the episode's status.
-- p_picks: [{ "category": "star_baker", "contestant_id": "<uuid>", "locked": false }, ...]
-- Categories left out of p_picks are cleared.
CREATE OR REPLACE FUNCTION admin_set_picks(p_player_id uuid, p_episode_id uuid, p_picks jsonb)
RETURNS void AS $$
BEGIN
  PERFORM set_config('fantasy.admin_override', 'on', true);

  DELETE FROM picks WHERE player_id = p_player_id AND episode_id = p_episode_id;

  INSERT INTO picks (player_id, episode_id, category, contestant_id, locked)
  SELECT p_player_id, p_episode_id, x.category, x.contestant_id, COALESCE(x.locked, false)
  FROM jsonb_to_recordset(COALESCE(p_picks, '[]'::jsonb))
    AS x(category text, contestant_id uuid, locked boolean);

  PERFORM set_config('fantasy.admin_override', 'off', true);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION admin_set_picks(uuid, uuid, jsonb) TO anon, authenticated;

COMMIT;

-- Make the new function visible to the API straight away.
NOTIFY pgrst, 'reload schema';
