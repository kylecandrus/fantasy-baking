# Fantasy Bake Off

A family fantasy league for The Great British Bake Off / Baking Show. Next.js (app router) + Supabase + Tailwind.

## Run locally

```bash
npm install
npm run dev
```

Create `.env.local` with your Supabase project's values (Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Without them the app runs against a stub and every page shows its empty state.

## Database

- `supabase/schema.sql` — full schema for a brand-new Supabase project.
- `supabase/migrations/` — run-once scripts for an existing project, pasted into the Supabase SQL Editor.

## Starting a new season

1. Copy the latest file in `supabase/migrations/` and update the archive table prefix, the baker names, and episode 1.
2. Run it in the Supabase SQL Editor. It archives last season into the private `archive` schema, clears episodes/picks/results/scores/contestants (players are kept), and seeds the new cast.
3. In **Admin → Contestants**, upload baker photos.
4. In **Admin → Episodes**, set when picks close for episode 1.

## Each week

1. **Admin → Episodes**: add the episode with a "picks close" time and open it. Picks lock automatically at that time (enforced in the database too).
2. After it airs, **Admin → Results**: enter results (Handshake and Sent Home can be "none this week"), then Score.
3. On the final, tick "This is the final" and record the season winner so winner-guess points pay out.
