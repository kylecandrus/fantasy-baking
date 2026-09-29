import { supabase } from './supabase';
import { Episode, Pick, Result } from './types';
import { calculatePickScore, calculateWinnerGuessScore } from './scoring';

/**
 * Recalculates one player's points for one already-scored week, after the commissioner
 * has corrected their picks. Same rules as scoring the whole week in Admin > Results,
 * just narrowed to a single player so nobody else's rows are touched.
 */
export async function rescorePlayerWeek(
  playerId: string,
  episode: Episode
): Promise<{ error: string | null; points: number }> {
  const [picksRes, resultsRes, winnerRes] = await Promise.all([
    supabase.from('picks').select('*').eq('player_id', playerId).eq('episode_id', episode.id),
    supabase.from('results').select('*').eq('episode_id', episode.id),
    // The season winner is recorded against the finale, whichever week that was.
    supabase.from('results').select('*').eq('category', 'winner_guess').limit(1),
  ]);

  if (picksRes.error || resultsRes.error || winnerRes.error) {
    return { error: 'Failed to load picks or results.', points: 0 };
  }

  const picks = (picksRes.data as Pick[] | null) ?? [];
  const results = (resultsRes.data as Result[] | null) ?? [];
  const sentHomeContestantId = results.find((r) => r.category === 'sent_home')?.contestant_id || null;
  const starBakerContestantId = results.find((r) => r.category === 'star_baker')?.contestant_id || null;

  const scoreRows = picks
    // Winner guesses are paid out by the finale, not by the episode they were made in.
    .filter((pick) => pick.category !== 'winner_guess')
    .map((pick) => ({
      player_id: playerId,
      episode_id: episode.id,
      category: pick.category as string,
      points: calculatePickScore(pick, results, sentHomeContestantId, starBakerContestantId),
    }));

  // A winner guess only has points to fix once the finale has actually paid out.
  const winner = (winnerRes.data as Result[] | null)?.[0] ?? null;
  let winnerPaidOut = false;
  if (winner && episode.winner_guess_points) {
    const { data: finale, error: finaleError } = await supabase
      .from('episodes')
      .select('status')
      .eq('id', winner.episode_id)
      .limit(1);
    if (finaleError) return { error: 'Failed to check whether the final has been scored.', points: 0 };
    winnerPaidOut = finale?.[0]?.status === 'scored';
  }

  if (winnerPaidOut && winner) {
    const guess = picks.find((pick) => pick.category === 'winner_guess');
    if (guess) {
      scoreRows.push({
        player_id: playerId,
        episode_id: episode.id,
        category: 'winner_guess',
        points: calculateWinnerGuessScore(guess, winner.contestant_id, episode.winner_guess_points ?? 0),
      });
    }
  }

  // Clear this player's rows for the week first, so a pick they no longer hold stops scoring.
  let clearQuery = supabase.from('scores').delete().eq('player_id', playerId).eq('episode_id', episode.id);
  if (!winnerPaidOut) clearQuery = clearQuery.neq('category', 'winner_guess');
  const { error: deleteError } = await clearQuery;
  if (deleteError) return { error: 'Failed to clear old scores.', points: 0 };

  if (scoreRows.length > 0) {
    const { error: insertError } = await supabase
      .from('scores')
      .upsert(scoreRows, { onConflict: 'player_id,episode_id,category' });
    if (insertError) return { error: 'Failed to save scores.', points: 0 };
  }

  return { error: null, points: scoreRows.reduce((sum, row) => sum + row.points, 0) };
}
