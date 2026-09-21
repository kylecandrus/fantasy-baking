'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode, Contestant, Pick, Result, PickCategory, CATEGORIES, WINNER_GUESS_CATEGORY } from '@/lib/types';
import { useAdmin, usePlayer } from '@/hooks/usePlayer';
import { markWeekWatched } from '@/hooks/useWatched';
import { calculatePickScore, calculateWinnerGuessScore } from '@/lib/scoring';
import { ArrowLeft, ArrowRight, Check, Trophy, AlertCircle, Crown, Ban, Pencil } from 'lucide-react';
import ContestantAvatar from '@/components/ContestantAvatar';

// Star Baker / Technical Winner / Technical Loser always happen. A Hollywood handshake
// is rare and some weeks nobody goes home, so those two can be left as "None this week".
const REQUIRED_CATEGORIES: PickCategory[] = ['star_baker', 'technical_winner', 'technical_loser'];
const OPTIONAL_CATEGORIES: PickCategory[] = ['sent_home', 'handshake'];

export default function AdminResultsPage() {
  const params = useParams();
  const router = useRouter();
  const weekNumber = Number(params.week);
  const { isAdmin, loaded: adminLoaded } = useAdmin();
  const { playerId } = usePlayer();
  // One category per screen on the way through, then a review screen.
  const [step, setStep] = useState(0);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [existingResults, setExistingResults] = useState(false);
  const [isFinale, setIsFinale] = useState(false);
  const [confirmingScore, setConfirmingScore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: eps } = await supabase.from('episodes').select('*').order('week_number');

      const ep = (eps as Episode[] | null)?.find((e) => e.week_number === weekNumber);
      if (!ep) { setLoading(false); return; }
      setEpisode(ep);

      // The finale is simply the last episode of the season, whatever week that lands on.
      const maxWeek = Math.max(...(eps as Episode[]).map((e) => e.week_number));
      setIsFinale(ep.week_number === maxWeek && ep.week_number >= 10);

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

  // Categories this page owns. Winner Guess is only recorded here when the admin says
  // this is the final — on any other week the stored row (if any) is left untouched.
  const editableCategories = isFinale
    ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, label: 'Season Winner', points: episode?.winner_guess_points ?? 0 }]
    : CATEGORIES;

  const requiredFilled = REQUIRED_CATEGORIES.filter((key) => results[key]).length;
  const allRequiredFilled = requiredFilled === REQUIRED_CATEGORIES.length;

  function choose(category: PickCategory, contestantId: string | null) {
    setSaved(false);
    setConfirmingScore(false);
    setError(null);
    setResults((prev) => ({ ...prev, [category]: contestantId || '' }));
    // Brief pause so the tap visibly lands before the next category slides in.
    setTimeout(() => setStep((current) => current + 1), 180);
  }

  async function saveResults(): Promise<boolean> {
    if (!episode) return false;
    setSaving(true);
    setSaved(false);
    setConfirmingScore(false);
    setError(null);

    const filledRows = editableCategories
      .filter((cat) => results[cat.key])
      .map((cat) => ({ episode_id: episode.id, category: cat.key, contestant_id: results[cat.key] }));
    const clearedKeys = editableCategories.filter((cat) => !results[cat.key]).map((cat) => cat.key);

    // Drop rows for categories the admin cleared, so corrections actually take effect.
    if (clearedKeys.length > 0) {
      const { error: clearError } = await supabase
        .from('results')
        .delete()
        .eq('episode_id', episode.id)
        .in('category', clearedKeys);
      if (clearError) { setSaving(false); setError('Failed to clear results. Try again.'); return false; }
    }

    if (filledRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('results')
        .upsert(filledRows, { onConflict: 'episode_id,category' });
      if (upsertError) { setSaving(false); setError('Failed to save results. Try again.'); return false; }
    }

    const sentHomeId = results['sent_home'] || null;

    // Undo any elimination previously recorded for this week (the admin may have picked
    // the wrong baker, or decided nobody went home).
    let unelimQuery = supabase
      .from('contestants')
      .update({ eliminated_week: null })
      .eq('eliminated_week', episode.week_number);
    if (sentHomeId) unelimQuery = unelimQuery.neq('id', sentHomeId);
    const { error: unelimError } = await unelimQuery;
    if (unelimError) { setSaving(false); setError('Results saved but failed to un-eliminate the previous contestant.'); return false; }

    if (sentHomeId) {
      const { error: elimError } = await supabase
        .from('contestants')
        .update({ eliminated_week: episode.week_number })
        .eq('id', sentHomeId);
      if (elimError) { setSaving(false); setError('Results saved but failed to mark contestant as eliminated.'); return false; }
    }

    setContestants((prev) =>
      prev.map((c) => {
        if (c.id === sentHomeId) return { ...c, eliminated_week: episode.week_number };
        if (c.eliminated_week === episode.week_number) return { ...c, eliminated_week: null };
        return c;
      })
    );

    setSaving(false);
    setSaved(true);
    setExistingResults(true);
    // Whoever is entering results has obviously watched — don't spoiler-gate them.
    markWeekWatched(playerId, episode.week_number);
    return true;
  }

  async function saveAndScore() {
    if (await saveResults()) await scoreEpisode();
  }

  async function scoreEpisode() {
    if (!episode) return;
    setScoring(true);
    setConfirmingScore(false);
    setError(null);

    const [picksRes, resultsRes] = await Promise.all([
      supabase.from('picks').select('*').eq('episode_id', episode.id),
      supabase.from('results').select('*').eq('episode_id', episode.id),
    ]);

    if (picksRes.error || resultsRes.error || !picksRes.data || !resultsRes.data) {
      setScoring(false);
      setError('Failed to load picks or results.');
      return;
    }

    const typedPicks = picksRes.data as Pick[];
    const typedResults = resultsRes.data as Result[];

    const sentHomeContestantId = typedResults.find((r) => r.category === 'sent_home')?.contestant_id || null;
    const starBakerContestantId = typedResults.find((r) => r.category === 'star_baker')?.contestant_id || null;
    const actualWinnerId = typedResults.find((r) => r.category === 'winner_guess')?.contestant_id || null;

    if (isFinale && !actualWinnerId) {
      setScoring(false);
      setError('No season winner saved yet. Choose the Season Winner above and save results first.');
      return;
    }

    const scoreRows = typedPicks
      // Winner guesses are paid out by the finale, not by the episode they were made in.
      .filter((pick) => pick.category !== 'winner_guess')
      .map((pick) => ({
        player_id: pick.player_id,
        episode_id: episode.id,
        category: pick.category as string,
        points: calculatePickScore(pick, typedResults, sentHomeContestantId, starBakerContestantId),
      }));

    // Always clear this episode's own score rows (even when there are no picks), but never
    // wipe a winner-guess payout that the finale attached to this episode.
    const { error: deleteError } = await supabase
      .from('scores')
      .delete()
      .eq('episode_id', episode.id)
      .neq('category', 'winner_guess');
    if (deleteError) { setScoring(false); setError('Failed to clear old scores.'); return; }

    if (scoreRows.length > 0) {
      const { error: insertError } = await supabase
        .from('scores')
        .upsert(scoreRows, { onConflict: 'player_id,episode_id,category' });
      if (insertError) { setScoring(false); setError('Failed to save scores.'); return; }
    }

    // Finale: pay out every winner guess made earlier in the season.
    if (isFinale && actualWinnerId) {
      const { data: guessEpisodes, error: guessEpisodesError } = await supabase
        .from('episodes')
        .select('*')
        .not('winner_guess_points', 'is', null);
      if (guessEpisodesError) { setScoring(false); setError('Episode scored but failed to load winner guess weeks.'); return; }

      const guessEps = (guessEpisodes as Episode[] | null) ?? [];
      if (guessEps.length > 0) {
        const guessEpisodeIds = guessEps.map((e) => e.id);
        const pointsByEpisode = new Map(guessEps.map((e) => [e.id, e.winner_guess_points ?? 0]));

        const { data: guessPicks, error: guessPicksError } = await supabase
          .from('picks')
          .select('*')
          .in('episode_id', guessEpisodeIds)
          .eq('category', 'winner_guess');
        if (guessPicksError) { setScoring(false); setError('Episode scored but failed to load winner guesses.'); return; }

        // Replace the payout rows wholesale so re-running the finale is idempotent.
        const { error: clearWinnerError } = await supabase
          .from('scores')
          .delete()
          .in('episode_id', guessEpisodeIds)
          .eq('category', 'winner_guess');
        if (clearWinnerError) { setScoring(false); setError('Episode scored but failed to clear old winner guess scores.'); return; }

        const winnerScoreRows = ((guessPicks as Pick[] | null) ?? []).map((pick) => ({
          player_id: pick.player_id,
          episode_id: pick.episode_id,
          category: 'winner_guess',
          points: calculateWinnerGuessScore(pick, actualWinnerId, pointsByEpisode.get(pick.episode_id) ?? 0),
        }));

        if (winnerScoreRows.length > 0) {
          const { error: winnerInsertError } = await supabase
            .from('scores')
            .upsert(winnerScoreRows, { onConflict: 'player_id,episode_id,category' });
          if (winnerInsertError) { setScoring(false); setError('Episode scored but failed to score winner guesses.'); return; }
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

  const reviewStep = editableCategories.length;
  const onReview = step >= reviewStep;
  const cat = onReview ? null : editableCategories[step];
  const busy = saving || scoring;

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <div>
        <Link href="/admin/episodes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-1">
          <ArrowLeft size={14} /> Episodes
        </Link>
        <h1 className="font-display text-2xl text-ink">Enter Results</h1>
        <p className="text-ink-muted text-sm">Week {episode.week_number} &middot; {episode.theme}</p>
      </div>

      {/* Progress — tap a segment to jump */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Steps">
        {[...editableCategories.map((c) => c.label), 'Review'].map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            aria-label={`Go to ${label}`}
            aria-current={i === Math.min(step, reviewStep) ? 'step' : undefined}
            className="flex-1 py-2 cursor-pointer"
          >
            <span
              className={`block h-1.5 rounded-full transition-colors ${
                i === Math.min(step, reviewStep) ? 'bg-amber-btn' : i < step ? 'bg-amber/50' : 'bg-cream-dark'
              }`}
            />
          </button>
        ))}
      </div>

      {cat && (
        <div key={cat.key} className="space-y-4 animate-fade-up">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">
                {step + 1} of {editableCategories.length}
              </p>
              <h2 className="flex items-center gap-1.5 font-display text-2xl text-ink leading-tight">
                {cat.key === 'winner_guess' && <Crown size={18} className="text-amber-dark" />}
                {cat.label}
              </h2>
            </div>
            <span className="text-xs font-medium text-ink-muted bg-cream-dark px-2 py-1 rounded-md shrink-0">
              {cat.key === 'winner_guess' ? 'Season payout' : `${cat.points} pts`}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {(cat.key === 'winner_guess' ? contestants : activeContestants).map((c) => {
              const selected = results[cat.key] === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => choose(cat.key, c.id)}
                  aria-pressed={selected}
                  className={`relative min-h-[104px] p-2.5 rounded-2xl text-sm font-medium text-center transition-all border cursor-pointer active:scale-[0.97] ${
                    selected
                      ? 'bg-amber-subtle border-amber text-amber-dark ring-2 ring-amber/30'
                      : 'bg-surface border-border text-ink-secondary hover:border-ink-faint'
                  }`}
                >
                  {selected && <Check size={14} strokeWidth={3} className="absolute top-2 right-2 text-amber-dark" />}
                  <ContestantAvatar contestant={c} className="w-14 h-14 text-base mx-auto mb-1.5" />
                  <span className="block leading-tight">{c.name}</span>
                </button>
              );
            })}
          </div>

          {OPTIONAL_CATEGORIES.includes(cat.key) && (
            <button
              onClick={() => choose(cat.key, null)}
              className="btn btn-secondary btn-lg w-full border-dashed"
            >
              <Ban size={16} />
              {cat.key === 'handshake' ? 'No handshake this week' : 'Nobody went home'}
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(step - 1)} disabled={step === 0} className="btn btn-secondary flex-1 min-h-12">
              <ArrowLeft size={16} /> Back
            </button>
            <button onClick={() => setStep(step + 1)} className="btn btn-secondary flex-1 min-h-12">
              {results[cat.key] || OPTIONAL_CATEGORIES.includes(cat.key) ? 'Next' : 'Skip'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {onReview && (
        <div className="space-y-4 animate-fade-up">
          <div>
            <p className="eyebrow">Review</p>
            <h2 className="font-display text-2xl text-ink leading-tight">Does this look right?</h2>
          </div>

          <div className="card overflow-hidden divide-y divide-border/60">
            {editableCategories.map((c, i) => {
              const chosen = contestants.find((x) => x.id === results[c.key]);
              const required = REQUIRED_CATEGORIES.includes(c.key) || c.key === 'winner_guess';
              return (
                <button
                  key={c.key}
                  onClick={() => setStep(i)}
                  className="w-full min-h-16 px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-cream/60 transition-colors"
                >
                  <span className="text-xs text-ink-muted w-24 shrink-0 leading-tight">{c.label}</span>
                  {chosen ? (
                    <>
                      <ContestantAvatar contestant={chosen} className="w-9 h-9 text-xs" />
                      <span className="font-semibold text-ink flex-1 min-w-0 truncate">{chosen.name}</span>
                    </>
                  ) : (
                    <span className={`flex-1 text-sm ${required ? 'font-medium text-terracotta' : 'text-ink-muted'}`}>
                      {required ? 'Tap to choose' : 'None this week'}
                    </span>
                  )}
                  <Pencil size={14} className="text-ink-faint shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              const next = !isFinale;
              setIsFinale(next);
              setConfirmingScore(false);
              // Turning it on adds a Season Winner step at the end — go straight there.
              if (next) setStep(CATEGORIES.length);
            }}
            aria-pressed={isFinale}
            className="card p-4 flex items-start gap-3 w-full text-left cursor-pointer"
          >
            <span
              className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-all ${
                isFinale ? 'bg-amber-btn border-amber-btn text-white' : 'bg-surface border-border text-transparent'
              }`}
            >
              <Check size={13} strokeWidth={3} />
            </span>
            <span>
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Crown size={14} className="text-amber-dark" />
                This is the final — record the season winner
              </span>
              <span className="block text-xs text-ink-muted mt-0.5">
                Scoring will also pay out every winner guess made earlier in the season.
              </span>
            </span>
          </button>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {!allRequiredFilled && (
            <p className="text-sm text-ink-muted text-center">
              Star Baker, Technical Winner and Technical Loser are needed before scoring.
            </p>
          )}

          {!confirmingScore ? (
            <div className="space-y-2">
              <button
                onClick={() => { setError(null); setConfirmingScore(true); }}
                disabled={busy || !allRequiredFilled}
                className="btn btn-success btn-lg w-full"
              >
                <Trophy size={18} />
                {scoring ? 'Scoring…' : existingResults ? 'Save & re-score week' : 'Save & score week'}
              </button>
              <button onClick={saveResults} disabled={busy || !allRequiredFilled} className="btn btn-secondary w-full min-h-12">
                {saved ? <Check size={16} /> : null}
                {saving ? 'Saving…' : saved ? 'Saved — not scored yet' : 'Save only, score later'}
              </button>
            </div>
          ) : (
            <div className="card p-4 space-y-3 animate-fade-up">
              <div className="flex items-start gap-2 text-sm text-ink">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-dark" />
                <span>
                  This rewrites everyone&apos;s points for week {episode.week_number}. Each player only sees them after
                  tapping &ldquo;I&apos;ve watched&rdquo;.
                  {isFinale && ' It also pays out all winner guesses from earlier weeks.'}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={saveAndScore} disabled={busy} className="btn btn-success flex-1 min-h-12">
                  <Trophy size={16} />
                  {busy ? 'Working…' : 'Yes, score it'}
                </button>
                <button onClick={() => setConfirmingScore(false)} disabled={busy} className="btn btn-secondary flex-1 min-h-12">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
