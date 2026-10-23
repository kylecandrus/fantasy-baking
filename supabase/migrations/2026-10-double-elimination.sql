-- Double eliminations
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run; it touches no data.
--
-- Some weeks two bakers go home. The results table only allowed one row per category
-- per episode, so the second "sent home" baker could not be recorded and anyone who
-- picked them scored nothing. This lets an episode carry more than one sent-home row
-- (still at most one row per baker per category). The app keeps the other categories
-- to a single baker.

BEGIN;

-- Drop whichever unique constraint covers exactly (episode_id, category); its name
-- depends on how the table was created.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.results'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) = ARRAY['category', 'episode_id']
  LOOP
    EXECUTE format('ALTER TABLE results DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE results DROP CONSTRAINT IF EXISTS results_episode_category_contestant_key;
ALTER TABLE results
  ADD CONSTRAINT results_episode_category_contestant_key UNIQUE (episode_id, category, contestant_id);

COMMIT;

-- Make the changed constraint visible to the API straight away.
NOTIFY pgrst, 'reload schema';
