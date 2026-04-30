'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Episode, Contestant, CATEGORIES, WINNER_GUESS_CATEGORY } from '@/lib/types';
import { usePlayer } from '@/hooks/usePlayer';
import PlayerSelector from '@/components/PlayerSelector';
import { Target, Check, AlertCircle, Lock } from 'lucide-react';

export default function PicksPage() {
  const { playerId, loaded } = usePlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [existingPicks, setExistingPicks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: episodes } = await supabase
        .from('episodes')
        .select('*')
        .eq('status', 'open')
        .order('week_number')
        .limit(1);

      if (episodes && episodes.length > 0) setEpisode(episodes[0]);

      const { data: allContestants } = await supabase
        .from('contestants')
        .select('*')
        .order('name');

      if (allContestants) setContestants(allContestants);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!playerId || !episode) return;
    supabase
      .from('picks')
      .select('*')
      .eq('player_id', playerId)
      .eq('episode_id', episode.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const existing: Record<string, string> = {};
          data.forEach((p) => (existing[p.category] = p.contestant_id));
          setPicks(existing);
          setExistingPicks(true);
          const locked = data.find((p) => p.locked);
          if (locked) setLockedCategory(locked.category);
        }
      });
  }, [playerId, episode]);

  const activeContestants = contestants.filter(
    (c) => c.eliminated_week === null || (episode && c.eliminated_week >= episode.week_number)
  );

  const allCategories = episode?.winner_guess_points
    ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: episode.winner_guess_points }]
    : CATEGORIES;

  const filledCount = Object.keys(picks).filter((k) => picks[k]).length;

  async function handleSave() {
    if (!playerId || !episode) return;
    if (filledCount < allCategories.length) {
      if (!confirm(`You've only filled ${filledCount} of ${allCategories.length} categories. Submit anyway?`)) return;
    }
    setSaving(true);
    setError(null);

    for (const cat of allCategories) {
      const contestantId = picks[cat.key];
      if (!contestantId) continue;

      const { error: upsertError } = await supabase.from('picks').upsert(
        {
          player_id: playerId,
          episode_id: episode.id,
          category: cat.key,
          contestant_id: contestantId,
          locked: lockedCategory === cat.key,
        },
        { onConflict: 'player_id,episode_id,category' }
      );
      if (upsertError) {
        setSaving(false);
        setError('Failed to save picks. Try again.');
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setExistingPicks(true);
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

      {/* Persistent helper — always visible, not conditional */}
      <div className="rounded-[12px] bg-amber-subtle/60 px-4 py-3 text-xs text-ink-secondary leading-relaxed flex gap-2.5">
        <Lock size={14} className="shrink-0 mt-0.5 text-amber-dark" />
        <span>
          Lock <strong className="text-ink">one</strong> category for <strong className="text-ink">2× points</strong> if correct — but lose half if wrong.
          {existingPicks && <span className="text-ink-muted"> · Your picks are saved; tap to update.</span>}
        </span>
      </div>

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
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg text-ink leading-none">{cat.label}</h3>
                <div className="flex items-center gap-2">
                  {hasPick && (
                    <button
                      onClick={() => setLockedCategory(isLocked ? null : cat.key)}
                      aria-pressed={isLocked}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${
                        isLocked
                          ? 'text-white bg-amber'
                          : 'text-ink-muted hover:text-amber-dark hover:bg-amber-subtle'
                      }`}
                    >
                      <Lock size={11} />
                      {isLocked ? 'Locked' : 'Lock'}
                    </button>
                  )}
                  <span className={`text-[11px] font-semibold tabular-nums px-2 py-1 rounded-md ${
                    isLocked ? 'bg-amber text-white' : 'bg-cream-dark text-ink-secondary'
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
                      onClick={() =>
                        setPicks((prev) => ({
                          ...prev,
                          [cat.key]: prev[cat.key] === c.id ? '' : c.id,
                        }))
                      }
                      className={`relative p-2 rounded-[10px] text-sm text-center transition-all cursor-pointer ${
                        selected
                          ? 'bg-surface ring-2 ring-amber text-ink font-semibold shadow-sm'
                          : `bg-cream-dark/60 hover:bg-cream-dark text-ink-secondary ${dim ? 'opacity-50 hover:opacity-100' : ''}`
                      }`}
                    >
                      {selected && (
                        <Check size={12} strokeWidth={3} className="absolute top-1.5 right-1.5 text-amber" />
                      )}
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt={c.name}
                          className="w-12 h-12 rounded-full mx-auto mb-1.5 object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full mx-auto mb-1.5 bg-cream flex items-center justify-center text-ink-muted text-sm font-semibold">
                          {c.name[0]}
                        </div>
                      )}
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
            <button
              onClick={handleSave}
              disabled={saving || filledCount === 0}
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
          </div>
        </div>
      </div>
    </div>
  );
}
