import { Pick, Result, PickCategory, CATEGORIES } from './types';

const POSITIVE_CATEGORIES: PickCategory[] = ['star_baker', 'technical_winner', 'handshake'];

export function calculatePickScore(
  pick: Pick,
  results: Result[],
  sentHomeContestantId: string | null
): number {
  const matchingResult = results.find((r) => r.category === pick.category);
  if (!matchingResult) return 0;

  // Check if this pick is correct
  if (pick.contestant_id === matchingResult.contestant_id) {
    const cat = CATEGORIES.find((c) => c.key === pick.category);
    return cat?.points ?? 0;
  }

  // Penalty: -1 if you picked someone who got sent home for a positive category
  if (
    sentHomeContestantId &&
    pick.contestant_id === sentHomeContestantId &&
    POSITIVE_CATEGORIES.includes(pick.category)
  ) {
    return -1;
  }

  return 0;
}

export function calculateWinnerGuessScore(
  pick: Pick,
  actualWinnerId: string | null,
  guessPoints: number
): number {
  if (!actualWinnerId || pick.category !== 'winner_guess') return 0;
  return pick.contestant_id === actualWinnerId ? guessPoints : 0;
}
