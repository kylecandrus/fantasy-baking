'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Episode,
  Contestant,
  Player,
  Pick,
  PickCategory,
  CATEGORIES,
  WINNER_GUESS_CATEGORY,
  getPlayerColor,
} from '@/lib/types';
import { isPicksOpen } from '@/lib/deadline';
import { rescorePlayerWeek } from '@/lib/rescore';
import { useNow } from '@/lib/useNow';
import { useAdmin } from '@/hooks/usePlayer';
import { ArrowLeft, Check, AlertCircle, Lock, RefreshCw, Target, Trophy, Info } from 'lucide-react';
import ContestantAvatar from '@/components/ContestantAvatar';

/** Every category a pick row can hold — used to clean up cleared picks on save. */
const ALL_PICK_CATEGORIES: PickCategory[] = [
  ...CATEGORIES.map((c) => c.key),
  WINNER_GUESS_CATEGORY.key,
];

const OVERRIDE_HINT =
  'Picks are closed for this week and the database doesn’t have the commissioner override yet — run supabase/migrations/2026-09-admin-picks.sql in the Supabase SQL Editor, then save again.';

/** Reads as "the admin-picks migration hasn't been run on this database yet". */
function isMissingOverride(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '');
}

export default function AdminPlayerPicksPage() {
  const params = useParams();
  const weekNumber = Number(params.week);
  const { isAdmin, loaded: adminLoaded } = useAdmin();
  const now = useNow();

  const [episode, setEpisode] = useState<Episode | null>(null);
  // Every week that has (or had) picks, for hopping back to fix an earlier one.
  const [weeks, setWeeks] = useState<Episode[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [episodePicks, setEpisodePicks] = useState<Pick[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Set after fixing picks on a scored week: what the player's week is worth now.
  const [rescoredPoints, setRescoredPoints] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // Moving between weeks reuses this page, so start each one with nobody selected.
    setSelectedPlayerId(null);
    setPicks({});
    setLockedCategory(null);
    setDirty(false);
    setSaved(false);
    setRescoredPoints(null);
    setError(null);

    const [episodeRes, playersRes, contestantsRes] = await Promise.all([
      supabase.from('episodes').select('*').order('week_number'),
      supabase.from('players').select('*').order('name'),
      supabase.from('contestants').select('*').order('name'),
    ]);

    if (episodeRes.error || playersRes.error || contestantsRes.error) {
      setLoadError("We couldn't reach the kitchen. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const episodes = (episodeRes.data as Episode[] | null) ?? [];
    const ep = episodes.find((e) => e.week_number === weekNumber) ?? null;
    setEpisode(ep);
    setWeeks(episodes.filter((e) => e.status !== 'upcoming'));
    setPlayers(playersRes.data ?? []);
    setContestants(contestantsRes.data ?? []);

    if (ep) {
      const { data, error: picksError } = await supabase.from('picks').select('*').eq('episode_id', ep.id);
      if (picksError) {
        setLoadError("We couldn't load this week's picks. Try again before making changes.");
        setLoading(false);
        return;
      }
      setEpisodePicks(data ?? []);
    }

    setLoading(false);
  }, [weekNumber]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount fetch
    load();
  }, [load]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? null;

  const activeContestants = contestants.filter(
    (c) => c.eliminated_week === null || (episode && c.eliminated_week >= episode.week_number)
  );

  const allCategories = episode?.winner_guess_points
    ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: episode.winner_guess_points }]
    : CATEGORIES;

  const filledCount = allCategories.filter((cat) => picks[cat.key]).length;
  const savedCount = (playerId: string) => episodePicks.filter((p) => p.player_id === playerId).length;
  const picksOpen = isPicksOpen(episode, now);

  function selectPlayer(playerId: string) {
    if (playerId === selectedPlayerId) return;
    if (dirty && selectedPlayer && !confirm(`Discard the changes you haven't saved for ${selectedPlayer.name}?`)) return;

    const theirs = episodePicks.filter((p) => p.player_id === playerId);
    const existing: Record<string, string> = {};
    theirs.forEach((p) => (existing[p.category] = p.contestant_id));
    setPicks(existing);
    setLockedCategory(theirs.find((p) => p.locked)?.category ?? null);
    setSelectedPlayerId(playerId);
    setDirty(false);
    setSaved(false);
    setRescoredPoints(null);
    setError(null);
  }

  function selectContestant(category: string, contestantId: string) {
    const cleared = picks[category] === contestantId;
    // Clearing the locked category has to release the lock too, otherwise
    // re-selecting later would silently re-lock it.
    if (cleared && lockedCategory === category) setLockedCategory(null);
    setPicks((prev) => ({ ...prev, [category]: cleared ? '' : contestantId }));
    setDirty(true);
    setSaved(false);
    setRescoredPoints(null);
  }

  async function handleSave() {
    if (!selectedPlayer || !episode || saving) return;

    // A lock only counts if that category still holds a pick.
    const effectiveLocked = lockedCategory && picks[lockedCategory] ? lockedCategory : null;
    const filled = allCategories.filter((cat) => picks[cat.key]);

    if (filled.length === 0 && !confirm(`Clear all of ${selectedPlayer.name}'s picks for week ${episode.week_number}?`)) return;

    setSaving(true);
    setSaved(false);
    setRescoredPoints(null);
    setError(null);

    const rows = filled.map((cat) => ({
      category: cat.key,
      contestant_id: picks[cat.key],
      locked: effectiveLocked === cat.key,
    }));

    // The override writes the whole set in one go and works after picks have closed.
    const { error: rpcError } = await supabase.rpc('admin_set_picks', {
      p_player_id: selectedPlayer.id,
      p_episode_id: episode.id,
      p_picks: rows,
    });

    if (rpcError && !isMissingOverride(rpcError)) {
      setSaving(false);
      setError(`Couldn't save ${selectedPlayer.name}'s picks: ${rpcError.message}`);
      return;
    }

    // No override on this database yet — write the rows the way a player would, which
    // the database only allows while picks are open.
    if (rpcError) {
      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from('picks')
          .upsert(
            rows.map((r) => ({ ...r, player_id: selectedPlayer.id, episode_id: episode.id })),
            { onConflict: 'player_id,episode_id,category' }
          );
        if (upsertError) {
          setSaving(false);
          setError(
            /picks are closed/i.test(upsertError.message)
              ? OVERRIDE_HINT
              : `Couldn't save ${selectedPlayer.name}'s picks: ${upsertError.message}`
          );
          return;
        }
      }

      const kept = new Set(rows.map((r) => r.category));
      const removed = ALL_PICK_CATEGORIES.filter((key) => !kept.has(key));
      if (removed.length > 0) {
        const { error: deleteError } = await supabase
          .from('picks')
          .delete()
          .eq('player_id', selectedPlayer.id)
          .eq('episode_id', episode.id)
          .in('category', removed);
        if (deleteError) {
          setSaving(false);
          setError("Saved, but we couldn't clear the picks you removed. Try again.");
          return;
        }
      }
    }

    // Re-read so the per-player counts reflect what actually landed.
    const { data: fresh } = await supabase.from('picks').select('*').eq('episode_id', episode.id);
    if (fresh) setEpisodePicks(fresh);

    setLockedCategory(effectiveLocked);
    setDirty(false);

    // The week's points are already on the board — bring this player's in line with the fix.
    if (episode.status === 'scored') {
      const rescore = await rescorePlayerWeek(selectedPlayer.id, episode);
      if (rescore.error) {
        setSaving(false);
        setError(
          `Picks saved, but ${selectedPlayer.name}'s points didn't update (${rescore.error}) Save again, or re-score the week from Edit Results.`
        );
        return;
      }
      setRescoredPoints(rescore.points);
    }

    setSaving(false);
    setSaved(true);
  }

  if (!adminLoaded || loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }
  if (!isAdmin) return <div className="card p-8 text-center"><Link href="/admin" className="text-amber-dark underline">Login to admin</Link></div>;

  const backLink = (
    <Link href="/admin/episodes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-1">
      <ArrowLeft size={14} /> Episodes
    </Link>
  );

  if (loadError) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="rounded-[16px] bg-terracotta-subtle p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={20} className="text-terracotta" />
          </div>
          <h3 className="font-display text-xl text-ink mb-1">Couldn&apos;t load picks</h3>
          <p className="text-sm text-ink-secondary mb-5">{loadError}</p>
          <button onClick={load} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="card p-8 text-center text-ink-muted">Episode not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-32">
      <div>
        {backLink}
        <h1 className="font-display text-2xl text-ink">Player picks</h1>
        <p className="text-ink-muted text-sm">Week {episode.week_number} &middot; {episode.theme}</p>
      </div>

      {/* Hop to another week — this is how you go back and fix an earlier one */}
      {weeks.length > 1 && (
        <nav aria-label="Week" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
          {weeks.map((w) => {
            const current = w.week_number === episode.week_number;
            return (
              <Link
                key={w.id}
                href={`/admin/picks/${w.week_number}`}
                aria-current={current ? 'page' : undefined}
                onClick={(e) => {
                  if (!current && dirty && selectedPlayer && !confirm(`Discard the changes you haven't saved for ${selectedPlayer.name}?`)) {
                    e.preventDefault();
                  }
                }}
                className={`shrink-0 min-h-10 px-3.5 inline-flex items-center rounded-full text-sm font-semibold transition-colors ${
                  current
                    ? 'bg-amber-btn text-white'
                    : 'bg-surface text-ink-secondary shadow-[0_1px_2px_rgba(45,27,14,0.04)] hover:bg-cream-dark/60'
                }`}
              >
                Week {w.week_number}
              </Link>
            );
          })}
        </nav>
      )}

      {/* What saving here means, given where the week is */}
      {episode.status === 'scored' ? (
        <div className="rounded-[12px] bg-amber-subtle/60 px-4 py-3 text-xs text-ink-secondary leading-relaxed flex gap-2.5">
          <Trophy size={14} className="shrink-0 mt-0.5 text-amber-dark" />
          <span>
            Week {episode.week_number} is already scored. Saving a fix here updates that player&apos;s{' '}
            <strong className="text-ink">points and the standings</strong> straight away.
          </span>
        </div>
      ) : picksOpen ? (
        <div className="rounded-[12px] bg-amber-subtle/60 px-4 py-3 text-xs text-ink-secondary leading-relaxed flex gap-2.5">
          <Info size={14} className="shrink-0 mt-0.5 text-amber-dark" />
          <span>Picks are still open, so players can change anything you enter here.</span>
        </div>
      ) : (
        <div className="rounded-[12px] bg-amber-subtle/60 px-4 py-3 text-xs text-ink-secondary leading-relaxed flex gap-2.5">
          <Lock size={14} className="shrink-0 mt-0.5 text-amber-dark" />
          <span>
            Picks are closed for players. Saving here is a <strong className="text-ink">commissioner override</strong>.
          </span>
        </div>
      )}

      {/* Who are these picks for? */}
      <div>
        <p className="eyebrow mb-2">Entering picks for</p>
        {players.length === 0 ? (
          <div className="card p-6 text-center text-ink-muted text-sm">
            No players yet. <Link href="/admin/players" className="text-amber-dark underline">Add one</Link>.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {players.map((p) => {
              const color = getPlayerColor(p.color);
              const selected = p.id === selectedPlayerId;
              const count = savedCount(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => selectPlayer(p.id)}
                  aria-pressed={selected}
                  className={`min-h-14 px-3 py-2 rounded-[12px] flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                    selected
                      ? 'bg-amber-subtle ring-2 ring-amber'
                      : 'bg-surface shadow-[0_1px_2px_rgba(45,27,14,0.04)] hover:bg-cream-dark/60'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {p.name[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink text-sm truncate">{p.name}</span>
                    <span className={`block text-[11px] tabular-nums ${count === 0 ? 'text-terracotta' : 'text-ink-muted'}`}>
                      {count === 0 ? 'No picks yet' : `${count}/${allCategories.length} picked`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedPlayer && (
        <>
          <div className="rounded-[12px] bg-amber-subtle/60 px-4 py-3 text-xs text-ink-secondary leading-relaxed flex gap-2.5">
            <Lock size={14} className="shrink-0 mt-0.5 text-amber-dark" />
            <span>
              Lock <strong className="text-ink">one</strong> category for <strong className="text-ink">2× points</strong> if correct — but lose half if wrong.
            </span>
          </div>

          {/* Categories — desktop 2-column */}
          <div key={selectedPlayer.id} className="grid grid-cols-1 md:grid-cols-2 md:gap-x-5 gap-y-5 stagger">
            {allCategories.map((cat) => {
              const isLocked = lockedCategory === cat.key;
              const hasPick = !!picks[cat.key];
              const pool = cat.key === 'winner_guess' ? contestants : activeContestants;
              return (
                <div
                  key={cat.key}
                  className={`rounded-[16px] p-4 md:p-5 transition-colors ${
                    isLocked ? 'bg-amber-subtle' : 'bg-surface shadow-[0_1px_2px_rgba(45,27,14,0.04)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-lg text-ink leading-none">{cat.label}</h3>
                    <div className="flex items-center gap-2">
                      {hasPick && (
                        /* Tap target is 40px tall; the negative margin keeps the row its
                           original height so the pill still reads as a pill. */
                        <button
                          onClick={() => {
                            setLockedCategory(isLocked ? null : cat.key);
                            setDirty(true);
                            setSaved(false);
                          }}
                          aria-pressed={isLocked}
                          aria-label={isLocked ? `Unlock ${cat.label}` : `Lock ${cat.label} for double points`}
                          className="-my-2 -mx-1 px-1 py-2 min-h-[40px] inline-flex items-center cursor-pointer"
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
                          aria-pressed={selected}
                          className={`relative p-2 rounded-[10px] text-sm text-center transition-all cursor-pointer ${
                            selected
                              ? 'bg-surface ring-2 ring-amber text-ink font-semibold shadow-sm'
                              : `bg-cream-dark/60 text-ink-secondary hover:bg-cream-dark ${
                                  dim ? 'opacity-50 hover:opacity-100' : ''
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
                <div className="flex items-start gap-2 px-4 py-3 rounded-[12px] bg-terracotta-subtle border border-terracotta/20 text-sm text-terracotta mb-2 shadow-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              <div className="bg-cream/95 backdrop-blur-md rounded-[14px] p-1.5 shadow-[0_8px_24px_rgba(45,27,14,0.08)]">
                <button
                  onClick={handleSave}
                  disabled={saving || (filledCount === 0 && savedCount(selectedPlayer.id) === 0)}
                  className={`btn btn-lg w-full ${saved ? 'btn-success' : 'btn-primary'}`}
                >
                  {saving ? (
                    'Saving…'
                  ) : saved ? (
                    <>
                      <Check size={18} />
                      Saved for {selectedPlayer.name}
                      {rescoredPoints !== null && (
                        <span className="ml-1 opacity-80 tabular-nums">
                          · now {rescoredPoints} {rescoredPoints === 1 ? 'pt' : 'pts'}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <Target size={18} />
                      Save {selectedPlayer.name}&apos;s picks
                      <span className="ml-1 opacity-70 tabular-nums">
                        {filledCount}/{allCategories.length}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
