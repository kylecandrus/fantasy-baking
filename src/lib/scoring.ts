import { Pick, Result, CATEGORIES } from './types';

export function calculatePickScore(pick: Pick, results: Result[]): number {
  // A category can have more than one result: two bakers can go home in the same week.
  const matching = results.filter((r) => r.category === pick.category);

  // No result for this category (e.g. no handshake or no elimination this week):
  // everyone scores 0, including locked picks — a missing result is never a penalty.
  if (matching.length === 0) return 0;

  const cat = CATEGORIES.find((c) => c.key === pick.category);
  const basePoints = cat?.points ?? 0;
  const locked = !!pick.locked;

  // Check if this pick is correct
  if (matching.some((r) => r.contestant_id === pick.contestant_id)) {
    return locked ? basePoints * 2 : basePoints;
  }

  // Check if a penalty applies (Star Baker pick goes home, or Sent Home pick is Star Baker)
  const sentHomeIds = results.filter((r) => r.category === 'sent_home').map((r) => r.contestant_id);
  const starBakerId = results.find((r) => r.category === 'star_baker')?.contestant_id ?? null;
  const hasPenalty =
    (pick.category === 'star_baker' && sentHomeIds.includes(pick.contestant_id)) ||
    (pick.category === 'sent_home' && starBakerId !== null && pick.contestant_id === starBakerId);

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
