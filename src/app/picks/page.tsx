'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Episode,
  Contestant,
  PickCategory,
  CATEGORIES,
  WINNER_GUESS_CATEGORY,
} from '@/lib/types';
import { isPicksOpen, formatDeadline } from '@/lib/deadline';
import { useNow } from '@/lib/useNow';
import { usePlayer } from '@/hooks/usePlayer';
import PlayerSelector from '@/components/PlayerSelector';
import DeadlineNotice from '@/components/DeadlineNotice';
import Link from 'next/link';
import { Target, Check, AlertCircle, Lock, RefreshCw } from 'lucide-react';
import ContestantAvatar from '@/components/ContestantAvatar';
import SpoilerGate from '@/components/SpoilerGate';
import { useWatched } from '@/hooks/useWatched';

/** Every category a pick row can hold — used to clean up cleared picks on save. */
const ALL_PICK_CATEGORIES: PickCategory[] = [
  ...CATEGORIES.map((c) => c.key),
  WINNER_GUESS_CATEGORY.key,
];

export default function PicksPage() {
  const { playerId, loaded } = usePlayer();
  const now = useNow();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [scoredWeeks, setScoredWeeks] = useState<number[]>([]);
  const { loaded: watchedLoaded, isWatched, markWatched } = useWatched();
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [existingPicks, setExistingPicks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setError(null);

    const [episodesRes, contestantsRes, scoredRes] = await Promise.all([
      supabase.from('episodes').select('*').eq('status', 'open').order('week_number').limit(1),
      supabase.from('contestants').select('*').order('name'),
      supabase.from('episodes').select('week_number').eq('status', 'scored').order('week_number'),
    ]);
    setScoredWeeks((scoredRes.data ?? []).map((e) => e.week_number));

    if (episodesRes.error || contestantsRes.error) {
      setLoadError("We couldn't reach the kitchen. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const open: Episode | null = episodesRes.data?.[0] ?? null;
    setEpisode(open);
    setContestants(contestantsRes.data ?? []);

    // Start from whatever this player already has saved for the open episode.
    if (open && playerId) {
      const { data, error: picksError } = await supabase
        .from('picks')
        .select('*')
        .eq('player_id', playerId)
        .eq('episode_id', open.id);

      if (picksError) {
        setLoadError("We couldn't load your saved picks. Try again before making changes.");
        setLoading(false);
        return;
      }

      const existing: Record<string, string> = {};
      data?.forEach((p) => (existing[p.category] = p.contestant_id));
      setPicks(existing);
      setExistingPicks((data?.length ?? 0) > 0);
      setLockedCategory(data?.find((p) => p.locked)?.category ?? null);
    } else {
      setPicks({});
      setExistingPicks(false);
      setLockedCategory(null);
    }

    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount fetch; also re-runs when the player changes
    load();
  }, [load]);

  const activeContestants = contestants.filter(
    (c) => c.eliminated_week === null || (episode && c.eliminated_week >= episode.week_number)
  );

  const allCategories = episode?.winner_guess_points
    ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: episode.winner_guess_points }]
    : CATEGORIES;

  const filledCount = allCategories.filter((cat) => picks[cat.key]).length;
  const picksOpen = isPicksOpen(episode, now);

  function selectContestant(category: string, contestantId: string) {
    const cleared = picks[category] === contestantId;
    // Clearing the locked category has to release the lock too, otherwise
    // re-selecting later would silently re-lock it.
    if (cleared && lockedCategory === category) setLockedCategory(null);
    setPicks((prev) => ({ ...prev, [category]: cleared ? '' : contestantId }));
  }

  async function handleSave() {
    if (!playerId || !episode || saving) return;

    // A lock only counts if that category still holds a pick.
    const effectiveLocked = lockedCategory && picks[lockedCategory] ? lockedCategory : null;
    const filled = allCategories.filter((cat) => picks[cat.key]);

    if (filled.length < allCategories.length) {
      if (!confirm(`You've only filled ${filled.length} of ${allCategories.length} categories. Submit anyway?`)) return;
    }

    setSaving(true);
    setError(null);

    // Never trust the episode we loaded — re-read it so a deadline that passed
    // (or a commissioner lock) while this page sat open still wins.
    const { data: freshRows, error: freshError } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', episode.id)
      .limit(1);

    if (freshError) {
      setSaving(false);
      setError("We couldn't check whether picks are still open. Try again.");
      return;
    }

    const current: Episode | null = freshRows?.[0] ?? null;
    if (!current) {
      setSaving(false);
      setEpisode(null);
      setError('That episode is no longer on the schedule.');
      return;
    }

    setEpisode(current);
    if (!isPicksOpen(current)) {
      setSaving(false);
      setError(
        current.status === 'open'
          ? `Picks closed ${formatDeadline(current.lock_at)} — this week is locked now.`
          : 'The commissioner locked this week. Your last saved picks are final.'
      );
      return;
    }

    const rows = filled.map((cat) => ({
      player_id: playerId,
      episode_id: current.id,
      category: cat.key,
      contestant_id: picks[cat.key],
      locked: effectiveLocked === cat.key,
    }));

    // One upsert for every filled category, so `locked` is rewritten on all of them —
    // a stale lock can't survive on a category the player has since unlocked.
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('picks')
        .upsert(rows, { onConflict: 'player_id,episode_id,category' });
      if (upsertError) {
        setSaving(false);
        setError('Failed to save picks. Try again.');
        return;
      }
    }

    // Anything the player cleared has to actually go away, or the old pick keeps scoring.
    const kept = new Set(rows.map((r) => r.category));
    const removed = ALL_PICK_CATEGORIES.filter((key) => !kept.has(key));
    if (removed.length > 0) {
      const { error: deleteError } = await supabase
        .from('picks')
        .delete()
        .eq('player_id', playerId)
        .eq('episode_id', current.id)
        .in('category', removed);
      if (deleteError) {
        setSaving(false);
        setError("Saved, but we couldn't clear the picks you removed. Try again.");
        return;
      }
    }

    setLockedCategory(effectiveLocked);
    setSaving(false);
    setSaved(true);
    setExistingPicks(rows.length > 0);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!loaded || loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <header>
            <h1 className="font-display text-3xl text-ink leading-tight">Make your picks</h1>
            <p className="text-ink-secondary mt-1 text-sm">Something went wrong on the way here.</p>
          </header>
          <PlayerSelector compact />
        </div>
        <div className="rounded-[16px] bg-terracotta-subtle p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={20} className="text-terracotta" />
          </div>
          <h3 className="font-display text-xl text-ink mb-1">Couldn&apos;t load your picks</h3>
          <p className="text-sm text-ink-secondary mb-5">{loadError}</p>
          <button onClick={load} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl text-ink leading-tight">Make your picks</h1>
          <p className="text-ink-secondary mt-1 text-sm">Select your name first.</p>
        </header>
        <PlayerSelector />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <header>
            <h1 className="font-display text-3xl text-ink leading-tight">Make your picks</h1>
            <p className="text-ink-secondary mt-1 text-sm">No episode is open right now.</p>
          </header>
          <PlayerSelector compact />
        </div>
        <div className="rounded-[16px] bg-cream-dark/60 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={20} className="text-ink-muted" />
          </div>
          <h3 className="font-display text-xl text-ink mb-1">Picks are closed</h3>
          <p className="text-sm text-ink-secondary">Check back before the next episode airs.</p>
        </div>
      </div>
    );
  }

  // Spoiler guard: this week's baker list leaves out whoever went home, so hold it
  // back until the player has watched every earlier scored week.
  const unwatchedEarlier = scoredWeeks.filter((w) => w < episode.week_number && !isWatched(w));
  if (watchedLoaded && playerId && unwatchedEarlier.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <header>
            <h1 className="font-display text-3xl text-ink leading-tight">Make your picks</h1>
            <p className="text-ink-secondary mt-1 text-sm">
              Week {episode.week_number} · {episode.theme}
            </p>
          </header>
          <PlayerSelector compact />
        </div>
        <DeadlineNotice episode={episode} />
        <SpoilerGate
          weeks={unwatchedEarlier}
          onReveal={() => unwatchedEarlier.forEach((w) => markWatched(w))}
          message={`This week's baker list shows who's left, which gives away who went home. Watch first, then pick.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-32">
      <div className="flex items-start justify-between gap-3">
        <header>
          <h1 className="font-display text-3xl text-ink leading-tight">Make your picks</h1>
          <p className="text-ink-secondary mt-1 text-sm">
            Week {episode.week_number} · {episode.theme}
          </p>
        </header>
        <PlayerSelector compact />
      </div>

      {/* Deadline — live countdown, flips to closed on its own */}
      <DeadlineNotice episode={episode} />

      {picksOpen ? (
        /* Persistent helper — always visible, not conditional */
        <div className="rounded-[12px] bg-amber-subtle/60 px-4 py-3 text-xs text-ink-secondary leading-relaxed flex gap-2.5">
          <Lock size={14} className="shrink-0 mt-0.5 text-amber-dark" />
          <span>
            Lock <strong className="text-ink">one</strong> category for <strong className="text-ink">2× points</strong> if correct — but lose half if wrong.
            {existingPicks && <span className="text-ink-muted"> · Your picks are saved; tap to update.</span>}
          </span>
        </div>
      ) : (
        <div className="rounded-[16px] bg-cream-dark/60 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center mx-auto mb-3">
            <Lock size={20} className="text-ink-muted" />
          </div>
          <h3 className="font-display text-xl text-ink mb-1">Picks are closed</h3>
          <p className="text-sm text-ink-secondary">
            {existingPicks
              ? 'Your last saved picks are locked in. Tune in for the results.'
              : 'The deadline passed before you got your picks in this week.'}
          </p>
          <Link href={`/episodes/${episode.week_number}`} className="btn btn-secondary mt-4">
            See everyone&apos;s picks
          </Link>
        </div>
      )}

      {/* Categories — desktop 2-column */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-5 gap-y-5 stagger">
        {allCategories.map((cat) => {
          const isLocked = lockedCategory === cat.key;
          const hasPick = !!picks[cat.key];
          const pool = cat.key === 'winner_guess' ? contestants : activeContestants;
          return (
            <div
              key={cat.key}
              className={`rounded-[16px] p-4 md:p-5 transition-colors ${
                isLocked
                  ? 'bg-amber-subtle'
                  : 'bg-surface shadow-[0_1px_2px_rgba(45,27,14,0.04)]'
              } ${picksOpen ? '' : 'opacity-75'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg text-ink leading-none">{cat.label}</h3>
                <div className="flex items-center gap-2">
                  {hasPick && (
                    /* Tap target is 40px tall; the negative margin keeps the row its
                       original height so the pill still reads as a pill. */
                    <button
                      onClick={() => setLockedCategory(isLocked ? null : cat.key)}
                      aria-pressed={isLocked}
                      aria-label={isLocked ? `Unlock ${cat.label}` : `Lock ${cat.label} for double points`}
                      disabled={!picksOpen}
                      className="-my-2 -mx-1 px-1 py-2 min-h-[40px] inline-flex items-center disabled:cursor-not-allowed"
                    >
                      <span
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${
                          isLocked
                            ? 'text-white bg-amber'
                            : 'text-ink-muted hover:text-amber-dark hover:bg-amber-subtle'
                        }`}
                      >
                        <Lock size={11} />
                        {isLocked ? 'Locked' : 'Lock'}
                      </span>
                    </button>
                  )}
                  <span className={`text-[11px] font-semibold tabular-nums px-2 py-1 rounded-md ${
                    isLocked ? 'bg-amber-btn text-white' : 'bg-cream-dark text-ink-secondary'
                  }`}>
                    {isLocked ? `× 2 = ${cat.points * 2}` : `${cat.points} pts`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {pool.map((c) => {
                  const selected = picks[cat.key] === c.id;
                  const dim = hasPick && !selected;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectContestant(cat.key, c.id)}
                      disabled={!picksOpen}
                      className={`relative p-2 rounded-[10px] text-sm text-center transition-all ${
                        picksOpen ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        selected
                          ? 'bg-surface ring-2 ring-amber text-ink font-semibold shadow-sm'
                          : `bg-cream-dark/60 text-ink-secondary ${picksOpen ? 'hover:bg-cream-dark' : ''} ${
                              dim ? `opacity-50 ${picksOpen ? 'hover:opacity-100' : ''}` : ''
                            }`
                      }`}
                    >
                      {selected && (
                        <Check size={12} strokeWidth={3} className="absolute top-1.5 right-1.5 text-amber" />
                      )}
                      <ContestantAvatar contestant={c} className="w-12 h-12 text-sm mx-auto mb-1.5" />
                      <span className="block leading-tight">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom action bar — fixed, integrates with mobile nav stacking */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-4xl mx-auto px-4 md:px-6 pb-3 md:pb-4 pt-2 pointer-events-auto">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-[12px] bg-terracotta-subtle border border-terracotta/20 text-sm text-terracotta mb-2 shadow-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}
          <div className="bg-cream/95 backdrop-blur-md rounded-[14px] p-1.5 shadow-[0_8px_24px_rgba(45,27,14,0.08)]">
            {picksOpen ? (
              <button
                onClick={handleSave}
                disabled={saving || (filledCount === 0 && !existingPicks)}
                className={`btn btn-lg w-full ${saved ? 'btn-success' : 'btn-primary'}`}
              >
                {saving ? (
                  'Saving…'
                ) : saved ? (
                  <>
                    <Check size={18} />
                    Picks saved
                  </>
                ) : (
                  <>
                    <Target size={18} />
                    {existingPicks ? 'Update' : 'Submit'} picks
                    <span className="ml-1 opacity-70 tabular-nums">
                      {filledCount}/{allCategories.length}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <div className="btn btn-lg w-full text-ink-muted">
                <Lock size={18} />
                Picks closed for week {episode.week_number}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
