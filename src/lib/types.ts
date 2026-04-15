export type EpisodeStatus = 'upcoming' | 'open' | 'locked' | 'scored';

export type PickCategory =
  | 'star_baker'
  | 'technical_winner'
  | 'technical_loser'
  | 'sent_home'
  | 'handshake'
  | 'winner_guess';

export interface Player {
  id: string;
  name: string;
  is_admin: boolean;
  created_at: string;
}

export interface Contestant {
  id: string;
  name: string;
  image_url: string | null;
  eliminated_week: number | null;
  created_at: string;
}

export interface Episode {
  id: string;
  week_number: number;
  theme: string;
  status: EpisodeStatus;
  winner_guess_points: number | null;
  created_at: string;
}

export interface Pick {
  id: string;
  player_id: string;
  episode_id: string;
  category: PickCategory;
  contestant_id: string;
  created_at: string;
  // Joined fields
  player?: Player;
  contestant?: Contestant;
}

export interface Result {
  id: string;
  episode_id: string;
  category: PickCategory;
  contestant_id: string;
  created_at: string;
  // Joined fields
  contestant?: Contestant;
}

export interface PlayerScore {
  player: Player;
  weeklyPoints: number;
  totalPoints: number;
  breakdown: Record<PickCategory, number>;
}

export const CATEGORIES: { key: PickCategory; label: string; points: number }[] = [
  { key: 'star_baker', label: 'Star Baker', points: 4 },
  { key: 'technical_winner', label: 'Technical Winner', points: 2 },
  { key: 'technical_loser', label: 'Technical Loser', points: 2 },
  { key: 'sent_home', label: 'Sent Home', points: 3 },
  { key: 'handshake', label: 'Handshake', points: 5 },
];

export const WINNER_GUESS_CATEGORY = {
  key: 'winner_guess' as PickCategory,
  label: 'Winner Guess',
};
