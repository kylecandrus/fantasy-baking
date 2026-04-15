'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode, Contestant, Pick, Result, CATEGORIES, WINNER_GUESS_CATEGORY } from '@/lib/types';
import { useAdmin } from '@/hooks/usePlayer';
import { calculatePickScore, calculateWinnerGuessScore } from '@/lib/scoring';
import { ArrowLeft, Check, Save, Trophy, AlertCircle } from 'lucide-react';

export default function AdminResultsPage() {
  const params = useParams();
  const router = useRouter();
  const weekNumber = Number(params.week);
  const { isAdmin, loaded: adminLoaded } = useAdmin();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [existingResults, setExistingResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: eps } = await supabase
        .from('episodes')
        .select('*')
        .eq('week_number', weekNumber)
        .limit(1);

      if (!eps || eps.length === 0) { setLoading(false); return; }
      const ep = eps[0];
      setEpisode(ep);

      const [contestantsRes, resultsRes] = await Promise.all([
        supabase.from('contestants').select('*').order('name'),
        supabase.from('results').select('*').eq('episode_id', ep.id),
      ]);

      if (contestantsRes.data) setContestants(contestantsRes.data);
      if (resultsRes.data && resultsRes.data.length > 0) {
        const existing: Record<string, string> = {};
        resultsRes.data.forEach((r: Result) => (existing[r.category] = r.contestant_id));
        setResults(existing);
        setExistingResults(true);
      }
      setLoading(false);
    }
    load();
  }, [weekNumber]);

  const activeContestants = contestants.filter(
    (c) => c.eliminated_week === null || (episode && c.eliminated_week >= episode.week_number)
  );

  const allCategories = episode?.winner_guess_points
    ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: episode.winner_guess_points }]
    : CATEGORIES;

  async function saveResults() {
    if (!episode) return;
    setSaving(true);
    setError(null);

    for (const cat of allCategories) {
      const contestantId = results[cat.key];
      if (!contestantId) continue;

      const { error: upsertError } = await supabase.from('results').upsert(
        { episode_id: episode.id, category: cat.key, contestant_id: contestantId },
        { onConflict: 'episode_id,category' }
      );
      if (upsertError) {
        setSaving(false);
        setError('Failed to save results. Try again.');
        return;
      }
    }

    const sentHomeId = results['sent_home'];
    if (sentHomeId) {
      const { error: elimError } = await supabase.from('contestants').update({ eliminated_week: episode.week_number }).eq('id', sentHomeId);
      if (elimError) {
        setSaving(false);
        setError('Results saved but failed to mark contestant as eliminated.');
        return;
      }
    }

    setSaving(false);
    setExistingResults(true);
  }

  async function scoreEpisode() {
    if (!episode) return;
    setScoring(true);
    setError(null);

    const { data: picks } = await supabase.from('picks').select('*').eq('episode_id', episode.id);
    const { data: resultRows } = await supabase.from('results').select('*').eq('episode_id', episode.id);

    if (!picks || !resultRows) { setScoring(false); setError('Failed to load picks or results.'); return; }

    const typedPicks = picks as Pick[];
    const typedResults = resultRows as Result[];

    const sentHomeResult = typedResults.find((r) => r.category === 'sent_home');
    const sentHomeContestantId = sentHomeResult?.contestant_id || null;
    const starBakerResult = typedResults.find((r) => r.category === 'star_baker');
    const starBakerContestantId = starBakerResult?.contestant_id || null;
    const winnerResult = typedResults.find((r) => r.category === 'winner_guess');

    const scoreInserts: { player_id: string; episode_id: string; category: string; points: number }[] = [];

    for (const pick of typedPicks) {
      // Skip winner guesses — they're scored at the end of the season, not per-episode
      if (pick.category === 'winner_guess') continue;

      const points = calculatePickScore(pick, typedResults, sentHomeContestantId, starBakerContestantId);
      scoreInserts.push({ player_id: pick.player_id, episode_id: episode.id, category: pick.category, points });
    }

    if (scoreInserts.length > 0) {
      const { error: deleteError } = await supabase.from('scores').delete().eq('episode_id', episode.id);
      if (deleteError) { setScoring(false); setError('Failed to clear old scores.'); return; }

      const { error: insertError } = await supabase.from('scores').insert(scoreInserts);
      if (insertError) { setScoring(false); setError('Failed to save scores.'); return; }
    }

    // Week 10 (finale): automatically score all winner guesses from the season
    if (episode.week_number === 10) {
      const winnerResult = typedResults.find((r) => r.category === 'winner_guess');
      const actualWinnerId = winnerResult?.contestant_id || null;

      if (actualWinnerId) {
        // Find all episodes that had winner_guess_points (weeks 1 and 5)
        const { data: allEpisodes } = await supabase
          .from('episodes')
          .select('*')
          .not('winner_guess_points', 'is', null);

        if (allEpisodes) {
          const winnerScoreInserts: typeof scoreInserts = [];

          for (const ep of allEpisodes) {
            const { data: epPicks } = await supabase
              .from('picks')
              .select('*')
              .eq('episode_id', ep.id)
              .eq('category', 'winner_guess');

            if (epPicks) {
              // Clear any existing winner guess scores for this episode
              await supabase.from('scores').delete().eq('episode_id', ep.id).eq('category', 'winner_guess');

              for (const pick of epPicks) {
                const points = calculateWinnerGuessScore(pick as Pick, actualWinnerId, ep.winner_guess_points || 0);
                winnerScoreInserts.push({ player_id: pick.player_id, episode_id: ep.id, category: 'winner_guess', points });
              }
            }
          }

          if (winnerScoreInserts.length > 0) {
            const { error: winnerInsertError } = await supabase.from('scores').insert(winnerScoreInserts);
            if (winnerInsertError) { setScoring(false); setError('Episode scored but failed to score winner guesses.'); return; }
          }
        }
      }
    }

    const { error: statusError } = await supabase.from('episodes').update({ status: 'scored' }).eq('id', episode.id);
    if (statusError) { setScoring(false); setError('Scores saved but failed to lock episode.'); return; }

    setScoring(false);
    router.push(`/episodes/${weekNumber}`);
  }

  if (!adminLoaded || loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-10 w-64" />
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}
      </div>
    );
  }
  if (!isAdmin) return <div className="card p-8 text-center"><Link href="/admin" className="text-amber-dark underline">Login to admin</Link></div>;
  if (!episode) {
    return (
      <div className="space-y-4">
        <Link href="/admin/episodes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft size={14} /> Episodes
        </Link>
        <div className="card p-8 text-center text-ink-muted">Episode not found.</div>
      </div>
    );
  }

  const filledCount = Object.keys(results).filter((k) => results[k]).length;
  const requiredCount = CATEGORIES.length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/episodes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-1">
          <ArrowLeft size={14} /> Episodes
        </Link>
        <h1 className="font-display text-2xl text-ink">Enter Results</h1>
        <p className="text-ink-muted text-sm">Week {episode.week_number} &middot; {episode.theme}</p>
      </div>

      {existingResults && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-subtle border border-amber/15 text-sm text-amber-dark">
          <AlertCircle size={16} className="shrink-0" />
          Results already entered. You can update them below.
        </div>
      )}

      <div className="space-y-4 stagger">
        {allCategories.map((cat) => (
          <div key={cat.key} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ink">{cat.label}</h3>
              <span className="text-xs font-medium text-ink-muted bg-cream-dark px-2 py-0.5 rounded-md">{cat.points} pts</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {(cat.key === 'winner_guess' ? contestants : activeContestants).map((c) => {
                const selected = results[cat.key] === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setResults((prev) => ({ ...prev, [cat.key]: c.id }))}
                    className={`relative p-2.5 rounded-xl text-sm font-medium text-center transition-all border cursor-pointer ${
                      selected
                        ? 'bg-amber-subtle border-amber text-amber-dark ring-1 ring-amber/20'
                        : 'bg-surface border-border text-ink-secondary hover:border-ink-faint'
                    }`}
                  >
                    {selected && <Check size={12} className="absolute top-1.5 right-1.5 text-amber" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 sticky bottom-20 md:bottom-4 z-40 pt-2">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={saveResults}
          disabled={saving || filledCount < requiredCount}
          className="btn btn-primary btn-lg w-full shadow-lg"
        >
          <Save size={18} />
          {saving ? 'Saving...' : existingResults ? 'Update Results' : `Save Results (${filledCount}/${requiredCount})`}
        </button>

        {existingResults && (
          <button
            onClick={scoreEpisode}
            disabled={scoring}
            className="btn btn-success btn-lg w-full shadow-lg"
          >
            <Trophy size={18} />
            {scoring ? 'Scoring...' : 'Score Episode & Lock'}
          </button>
        )}
      </div>
    </div>
  );
}
