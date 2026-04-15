import { Pick, Result, PickCategory, CATEGORIES } from './types';

export function calculatePickScore(
  pick: Pick,
  results: Result[],
  sentHomeContestantId: string | null,
  starBakerContestantId: string | null
): number {
  const matchingResult = results.find((r) => r.category === pick.category);
  if (!matchingResult) return 0;

  const cat = CATEGORIES.find((c) => c.key === pick.category);
  const basePoints = cat?.points ?? 0;
  const locked = !!pick.locked;

  // Check if this pick is correct
  if (pick.contestant_id === matchingResult.contestant_id) {
    return locked ? basePoints * 2 : basePoints;
  }

  // Check if a penalty applies (Star Baker pick goes home, or Sent Home pick is Star Baker)
  const hasPenalty =
    (pick.category === 'star_baker' && sentHomeContestantId && pick.contestant_id === sentHomeContestantId) ||
    (pick.category === 'sent_home' && starBakerContestantId && pick.contestant_id === starBakerContestantId);

  if (locked) {
    // Lock penalty: lose half the base points (replaces the -1 penalty if applicable)
    return -Math.floor(basePoints / 2);
  }

  if (hasPenalty) {
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
  const locked = !!pick.locked;

  if (pick.contestant_id === actualWinnerId) {
    return locked ? guessPoints * 2 : guessPoints;
  }

  if (locked) {
    return -Math.floor(guessPoints / 2);
  }

  return 0;
}
