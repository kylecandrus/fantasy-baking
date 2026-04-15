-- Fantasy GBBO Database Schema
-- Run this in the Supabase SQL Editor to set up your database

-- Players (family members)
CREATE TABLE players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Contestants (bakers on the show)
CREATE TABLE contestants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  image_url text,
  eliminated_week int,
  created_at timestamptz DEFAULT now()
);

-- Episodes (each week of the season)
CREATE TABLE episodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number int NOT NULL,
  theme text NOT NULL,
  status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'locked', 'scored')),
  winner_guess_points int,
  created_at timestamptz DEFAULT now()
);

-- Picks (player predictions for each episode)
CREATE TABLE picks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('star_baker', 'technical_winner', 'technical_loser', 'sent_home', 'handshake', 'winner_guess')),
  contestant_id uuid REFERENCES contestants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, episode_id, category)
);

-- Results (actual outcomes entered by admin)
CREATE TABLE results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('star_baker', 'technical_winner', 'technical_loser', 'sent_home', 'handshake', 'winner_guess')),
  contestant_id uuid REFERENCES contestants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(episode_id, category)
);

-- Scores (calculated after each episode is scored)
CREATE TABLE scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  category text NOT NULL,
  points int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, episode_id, category)
);

-- Enable Row Level Security (open access for this family app)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write for all tables (family app, no auth)
CREATE POLICY "Allow all access" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON contestants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON episodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON scores FOR ALL USING (true) WITH CHECK (true);

-- Seed data: Players
INSERT INTO players (name, is_admin) VALUES
  ('Kyle', true),
  ('Erika', false),
  ('Brian', false),
  ('Jill', false);
