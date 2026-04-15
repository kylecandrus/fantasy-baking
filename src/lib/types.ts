export type EpisodeStatus = 'upcoming' | 'open' | 'locked' | 'scored';

export type PickCategory =
  | 'star_baker'
  | 'technical_winner'
  | 'technical_loser'
  | 'sent_home'
  | 'handshake'
  | 'winner_guess';

export type PlayerColor = 'amber' | 'terracotta' | 'sage' | 'slate' | 'plum' | 'burnt' | 'olive' | 'clay' | 'rose' | 'navy';

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  pin: string | null;
  created_at: string;
}

export const PLAYER_COLORS: { key: PlayerColor; label: string; bg: string; text: string }[] = [
  { key: 'amber', label: 'Amber', bg: '#C8902E', text: '#FFFFFF' },
  { key: 'terracotta', label: 'Terracotta', bg: '#C4756E', text: '#FFFFFF' },
  { key: 'sage', label: 'Sage', bg: '#5B8C5A', text: '#FFFFFF' },
  { key: 'slate', label: 'Slate', bg: '#6B8DAD', text: '#FFFFFF' },
  { key: 'plum', label: 'Plum', bg: '#8B6B7E', text: '#FFFFFF' },
  { key: 'burnt', label: 'Burnt Orange', bg: '#C67D4B', text: '#FFFFFF' },
  { key: 'olive', label: 'Olive', bg: '#7A8B5A', text: '#FFFFFF' },
  { key: 'clay', label: 'Clay', bg: '#9B7565', text: '#FFFFFF' },
  { key: 'rose', label: 'Rose', bg: '#B07D8E', text: '#FFFFFF' },
  { key: 'navy', label: 'Navy', bg: '#5A6B7A', text: '#FFFFFF' },
];

export function getPlayerColor(color?: string) {
  return PLAYER_COLORS.find((c) => c.key === color) || PLAYER_COLORS[0];
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
  locked: boolean;
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
