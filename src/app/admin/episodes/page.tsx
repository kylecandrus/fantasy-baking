'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode, EpisodeStatus } from '@/lib/types';
import { useAdmin } from '@/hooks/usePlayer';
import { ArrowLeft, Plus, Radio, Lock, Unlock, ClipboardCheck, Eye, Trash2, Crown } from 'lucide-react';

const STATUS_BADGE: Record<EpisodeStatus, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-cream-dark text-ink-muted' },
  open: { label: 'Open', className: 'bg-sage-subtle text-sage' },
  locked: { label: 'Locked', className: 'bg-terracotta-subtle text-terracotta' },
  scored: { label: 'Scored', className: 'bg-amber-subtle text-amber-dark' },
};

export default function AdminEpisodesPage() {
  const { isAdmin, loaded } = useAdmin();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [newTheme, setNewTheme] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  // Winner guess points: Week 1 = 10pts, Week 5 = 7pts, others = none
  function getWinnerGuessPoints(week: number): number | null {
    if (week === 1) return 10;
    if (week === 5) return 7;
    return null;
  }

  async function loadEpisodes() {
    const { data } = await supabase.from('episodes').select('*').order('week_number');
    if (data) setEpisodes(data);
    setLoading(false);
  }

  useEffect(() => { loadEpisodes(); }, []);

  async function addEpisode() {
    if (!newTheme.trim()) return;
    const nextWeek = episodes.length > 0 ? Math.max(...episodes.map((e) => e.week_number)) + 1 : 1;
    await supabase.from('episodes').insert({
      week_number: nextWeek,
      theme: newTheme.trim(),
      status: 'upcoming',
      winner_guess_points: getWinnerGuessPoints(nextWeek),
    });
    setNewTheme('');
    setShowAdd(false);
    loadEpisodes();
  }

  async function setStatus(id: string, status: EpisodeStatus) {
    await supabase.from('episodes').update({ status }).eq('id', id);
    loadEpisodes();
  }

  async function deleteEpisode(id: string) {
    if (!confirm('Delete this episode?')) return;
    await supabase.from('episodes').delete().eq('id', id);
    loadEpisodes();
  }

  if (!loaded) return null;
  if (!isAdmin) return <div className="card p-8 text-center"><Link href="/admin" className="text-amber-dark underline">Login to admin</Link></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-1">
            <ArrowLeft size={14} /> Admin
          </Link>
          <h1 className="font-display text-2xl text-ink">Episodes</h1>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary btn-sm">
          <Plus size={15} />
          Add
        </button>
      </div>

      {showAdd && (
        <div className="card p-4 space-y-3 animate-fade-up">
          <h3 className="font-semibold text-ink">
            New Episode — Week {(episodes.length > 0 ? Math.max(...episodes.map((e) => e.week_number)) : 0) + 1}
          </h3>
          <input
            type="text"
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEpisode()}
            placeholder="Theme (e.g. Cake Week)"
            className="input"
            autoFocus
          />
          {(() => {
            const nextWeek = (episodes.length > 0 ? Math.max(...episodes.map((e) => e.week_number)) : 0) + 1;
            const pts = getWinnerGuessPoints(nextWeek);
            return pts ? (
              <p className="text-xs text-amber-dark">Week {nextWeek} includes Winner Guess for {pts} pts</p>
            ) : null;
          })()}
          <div className="flex gap-2">
            <button onClick={addEpisode} disabled={!newTheme.trim()} className="btn btn-primary btn-sm">Add Episode</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
      ) : episodes.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted">No episodes yet. Add the first one!</div>
      ) : (
        <div className="space-y-2 stagger">
          {episodes.map((ep) => {
            const badge = STATUS_BADGE[ep.status];
            return (
              <div key={ep.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-ink-muted">Week {ep.week_number}</span>
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                      {ep.winner_guess_points && (
                        <span className="badge bg-amber-subtle text-amber-dark">
                          <Crown size={9} />
                          {ep.winner_guess_points}pts
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-ink">{ep.theme}</h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ep.status === 'upcoming' && (
                    <button onClick={() => setStatus(ep.id, 'open')} className="btn btn-primary btn-sm">
                      <Radio size={13} /> Open Picks
                    </button>
                  )}
                  {ep.status === 'open' && (
                    <button onClick={() => setStatus(ep.id, 'locked')} className="btn btn-danger btn-sm">
                      <Lock size={13} /> Lock Picks
                    </button>
                  )}
                  {ep.status === 'locked' && (
                    <>
                      <Link href={`/admin/results/${ep.week_number}`} className="btn btn-primary btn-sm">
                        <ClipboardCheck size={13} /> Enter Results
                      </Link>
                      <button onClick={() => setStatus(ep.id, 'open')} className="btn btn-secondary btn-sm">
                        <Unlock size={13} /> Reopen
                      </button>
                    </>
                  )}
                  {ep.status === 'scored' && (
                    <Link href={`/episodes/${ep.week_number}`} className="btn btn-secondary btn-sm">
                      <Eye size={13} /> View
                    </Link>
                  )}
                  <button onClick={() => deleteEpisode(ep.id)} className="btn btn-danger btn-sm ml-auto">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
