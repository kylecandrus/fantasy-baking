'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Episode, Contestant, CATEGORIES, WINNER_GUESS_CATEGORY } from '@/lib/types';
import { usePlayer } from '@/hooks/usePlayer';
import PlayerSelector from '@/components/PlayerSelector';
import { Target, Check, AlertCircle } from 'lucide-react';

export default function PicksPage() {
  const { playerId, loaded } = usePlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
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
        }
      });
  }, [playerId, episode]);

  const activeContestants = contestants.filter(
    (c) => c.eliminated_week === null || (episode && c.eliminated_week >= episode.week_number)
  );

  const allCategories = episode?.winner_guess_points
    ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: episode.winner_guess_points }]
    : CATEGORIES;

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
        <div>
          <h1 className="font-display text-2xl text-ink">Make Your Picks</h1>
          <p className="text-ink-muted text-sm mt-0.5">Select your name first</p>
        </div>
        <PlayerSelector />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">Make Your Picks</h1>
          <PlayerSelector compact />
        </div>
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-ink-muted" />
          </div>
          <h3 className="font-display text-xl text-ink mb-1">No open episode</h3>
          <p className="text-sm text-ink-muted">Check back before the next episode airs.</p>
        </div>
      </div>
    );
  }

  const filledCount = Object.keys(picks).filter((k) => picks[k]).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Make Your Picks</h1>
          <p className="text-ink-muted text-sm mt-0.5">
            Week {episode.week_number} &middot; {episode.theme}
          </p>
        </div>
        <PlayerSelector compact />
      </div>

      {existingPicks && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-subtle border border-amber/15 text-sm text-amber-dark">
          <AlertCircle size={16} className="shrink-0" />
          You have existing picks. Tap to update them.
        </div>
      )}

      <div className="space-y-4 stagger">
        {allCategories.map((cat) => (
          <div key={cat.key} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ink">{cat.label}</h3>
              <span className="text-xs font-medium text-ink-muted bg-cream-dark px-2 py-0.5 rounded-md">
                {cat.points} pts
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {(cat.key === 'winner_guess' ? contestants : activeContestants).map((c) => {
                const selected = picks[cat.key] === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setPicks((prev) => ({
                      ...prev,
                      [cat.key]: prev[cat.key] === c.id ? '' : c.id,
                    }))}
                    className={`relative p-2 rounded-xl text-sm font-medium text-center transition-all border cursor-pointer ${
                      selected
                        ? 'bg-amber-subtle border-amber text-amber-dark ring-1 ring-amber/20'
                        : 'bg-surface border-border text-ink-secondary hover:border-ink-faint'
                    }`}
                  >
                    {selected && (
                      <Check size={12} className="absolute top-1.5 right-1.5 text-amber" />
                    )}
                    {c.image_url && (
                      <img src={c.image_url} alt={c.name} className="w-10 h-10 rounded-full mx-auto mb-1 object-cover" />
                    )}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-20 md:bottom-4 z-40 pt-2">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-2">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || filledCount === 0}
          className={`btn btn-lg w-full shadow-lg transition-all ${
            saved
              ? 'btn-success'
              : 'btn-primary'
          }`}
        >
          {saving ? (
            'Saving...'
          ) : saved ? (
            <>
              <Check size={18} />
              Picks Saved
            </>
          ) : (
            <>
              <Target size={18} />
              {existingPicks ? 'Update' : 'Submit'} Picks
              <span className="ml-1 opacity-60">{filledCount}/{allCategories.length}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
