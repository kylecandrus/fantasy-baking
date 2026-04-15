import { Pick, Result, PickCategory, CATEGORIES } from './types';

export function calculatePickScore(
  pick: Pick,
  results: Result[],
  sentHomeContestantId: string | null,
  starBakerContestantId: string | null
): number {
  const matchingResult = results.find((r) => r.category === pick.category);
  if (!matchingResult) return 0;

  // Check if this pick is correct
  if (pick.contestant_id === matchingResult.contestant_id) {
    const cat = CATEGORIES.find((c) => c.key === pick.category);
    return cat?.points ?? 0;
  }

  // Penalty: picked someone for Star Baker but they went home
  if (
    pick.category === 'star_baker' &&
    sentHomeContestantId &&
    pick.contestant_id === sentHomeContestantId
  ) {
    return -1;
  }

  // Penalty: picked someone to go home but they were Star Baker
  if (
    pick.category === 'sent_home' &&
    starBakerContestantId &&
    pick.contestant_id === starBakerContestantId
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
