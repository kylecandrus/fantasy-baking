'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode, EpisodeStatus } from '@/lib/types';
import {
  datetimeLocalToISO,
  formatDeadlineWithDate,
  isDatetimeLocalValid,
  toDatetimeLocalValue,
} from '@/lib/deadline';
import { useAdmin } from '@/hooks/usePlayer';
import { ArrowLeft, Plus, Radio, Lock, Unlock, ClipboardCheck, Eye, Trash2, Crown, Clock, AlertCircle, RefreshCw } from 'lucide-react';

const STATUS_BADGE: Record<EpisodeStatus, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-cream-dark text-ink-muted' },
  open: { label: 'Open', className: 'bg-sage-subtle text-sage' },
  locked: { label: 'Locked', className: 'bg-terracotta-subtle text-terracotta' },
  scored: { label: 'Scored', className: 'bg-amber-subtle text-amber-dark' },
};

/** Reads as "the season-17 migration hasn't been run on this database yet". */
function isMissingLockAtColumn(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('lock_at');
}

const MIGRATION_HINT =
  'This database doesn’t have the picks deadline column yet — run the season-17 migration (adds episodes.lock_at), then try again.';

export default function AdminEpisodesPage() {
  const { isAdmin, loaded } = useAdmin();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [newTheme, setNewTheme] = useState('');
  const [newLockAt, setNewLockAt] = useState('');
  // null = untouched, so the field keeps tracking the default as the week changes.
  const [newWinnerPoints, setNewWinnerPoints] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState<string | null>(null);
  const [editingDeadline, setEditingDeadline] = useState<string | null>(null);
  const [deadlineDraft, setDeadlineDraft] = useState('');

  // Winner guess points: Week 1 = 10pts, Week 5 = 7pts, others = none
  function getWinnerGuessPoints(week: number): number | null {
    if (week === 1) return 10;
    if (week === 5) return 7;
    return null;
  }

  const loadEpisodes = useCallback(async () => {
    setLoadError(null);
    const { data, error: loadErr } = await supabase.from('episodes').select('*').order('week_number');
    if (loadErr) {
      setLoadError("We couldn't load the episodes. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setEpisodes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount fetch
    loadEpisodes();
  }, [loadEpisodes]);

  const highestWeek = episodes.length > 0 ? Math.max(...episodes.map((e) => e.week_number)) : 0;
  const nextWeekPreview = highestWeek + 1;
  const defaultWinnerPoints = getWinnerGuessPoints(nextWeekPreview);
  const winnerPointsValue =
    newWinnerPoints ?? (defaultWinnerPoints !== null ? String(defaultWinnerPoints) : '');

  function resetAddForm() {
    setNewTheme('');
    setNewLockAt('');
    setNewWinnerPoints(null);
    setShowAdd(false);
  }

  async function addEpisode() {
    if (!newTheme.trim() || adding) return;
    if (!isDatetimeLocalValid(newLockAt)) {
      setError('That picks-close time isn’t a valid date and time.');
      return;
    }

    setAdding(true);
    setError(null);

    // Compute the week from a fresh read so a double-submit (or another admin)
    // can't mint two episodes with the same week number.
    const { data: latest, error: weekError } = await supabase
      .from('episodes')
      .select('week_number')
      .order('week_number', { ascending: false })
      .limit(1);

    if (weekError) {
      setAdding(false);
      setError("We couldn't work out the next week number. Try again.");
      return;
    }

    const nextWeek = latest && latest.length > 0 ? latest[0].week_number + 1 : 1;
    const trimmedPoints = winnerPointsValue.trim();
    const parsedPoints = trimmedPoints === '' ? null : Number(trimmedPoints);
    if (parsedPoints !== null && (!Number.isFinite(parsedPoints) || parsedPoints < 0)) {
      setAdding(false);
      setError('Winner guess points must be a positive number (or blank for none).');
      return;
    }

    const lockAtISO = datetimeLocalToISO(newLockAt);
    const payload: Record<string, unknown> = {
      week_number: nextWeek,
      theme: newTheme.trim(),
      status: 'upcoming',
      winner_guess_points: parsedPoints,
    };
    // Only send lock_at when the admin actually set one, so an un-migrated
    // database still accepts plain episodes.
    if (lockAtISO) payload.lock_at = lockAtISO;

    const { error: insertError } = await supabase.from('episodes').insert(payload);
    setAdding(false);

    if (insertError) {
      setError(
        isMissingLockAtColumn(insertError.message)
          ? MIGRATION_HINT
          : `Couldn't add the episode: ${insertError.message}`
      );
      return;
    }

    resetAddForm();
    loadEpisodes();
  }

  async function setStatus(id: string, status: EpisodeStatus) {
    setBusyId(id);
    setError(null);
    const { error: updateError } = await supabase.from('episodes').update({ status }).eq('id', id);
    setBusyId(null);
    setConfirmLock(null);
    if (updateError) {
      setError(`Couldn't update the episode: ${updateError.message}`);
      return;
    }
    loadEpisodes();
  }

  async function saveDeadline(id: string, value: string) {
    if (!isDatetimeLocalValid(value)) {
      setError('That picks-close time isn’t a valid date and time.');
      return;
    }
    setBusyId(id);
    setError(null);
    const { error: updateError } = await supabase
      .from('episodes')
      .update({ lock_at: datetimeLocalToISO(value) })
      .eq('id', id);
    setBusyId(null);
    if (updateError) {
      setError(
        isMissingLockAtColumn(updateError.message)
          ? MIGRATION_HINT
          : `Couldn't save the deadline: ${updateError.message}`
      );
      return;
    }
    setEditingDeadline(null);
    setDeadlineDraft('');
    loadEpisodes();
  }

  async function deleteEpisode(id: string) {
    setBusyId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('episodes').delete().eq('id', id);
    setBusyId(null);
    setConfirmDelete(null);
    if (deleteError) {
      setError(`Couldn't delete the episode: ${deleteError.message}`);
      return;
    }
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

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-[12px] bg-terracotta-subtle border border-terracotta/20 text-sm text-terracotta">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-semibold uppercase tracking-wider hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {showAdd && (
        <div className="card p-4 space-y-3 animate-fade-up">
          <h3 className="font-semibold text-ink">New Episode — Week {nextWeekPreview}</h3>
          <input
            type="text"
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEpisode()}
            placeholder="Theme (e.g. Cake Week)"
            className="input"
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="eyebrow block mb-1.5">Picks close</span>
              <input
                type="datetime-local"
                value={newLockAt}
                onChange={(e) => setNewLockAt(e.target.value)}
                className="input"
              />
              <span className="block mt-1 text-xs text-ink-muted">
                Your local time. Leave blank to lock by hand.
              </span>
            </label>
            <label className="block">
              <span className="eyebrow block mb-1.5">Winner guess points</span>
              <input
                type="number"
                min={0}
                value={winnerPointsValue}
                onChange={(e) => setNewWinnerPoints(e.target.value)}
                placeholder="None"
                className="input"
              />
              <span className="block mt-1 text-xs text-ink-muted">
                {defaultWinnerPoints !== null
                  ? `Default for week ${nextWeekPreview} is ${defaultWinnerPoints}. Blank = none.`
                  : 'Blank = no winner guess this week.'}
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={addEpisode} disabled={!newTheme.trim() || adding} className="btn btn-primary btn-sm">
              {adding ? 'Adding…' : 'Add Episode'}
            </button>
            <button onClick={resetAddForm} disabled={adding} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
      ) : loadError ? (
        <div className="card p-8 text-center">
          <p className="text-ink-secondary mb-4">{loadError}</p>
          <button onClick={loadEpisodes} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : episodes.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted">No episodes yet. Add the first one!</div>
      ) : (
        <div className="space-y-2 stagger">
          {episodes.map((ep) => {
            const badge = STATUS_BADGE[ep.status];
            const busy = busyId === ep.id;
            const editing = editingDeadline === ep.id;
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
                    <p className="flex items-center gap-1.5 mt-1 text-xs text-ink-muted">
                      <Clock size={12} className="shrink-0" />
                      {ep.lock_at
                        ? `Picks close ${formatDeadlineWithDate(ep.lock_at)}`
                        : 'No picks deadline — locks by hand'}
                    </p>
                  </div>
                </div>

                {editing ? (
                  <div className="flex flex-wrap items-end gap-2 mb-3 p-3 rounded-[12px] bg-cream">
                    <label className="flex-1 min-w-[220px]">
                      <span className="eyebrow block mb-1.5">Picks close (your local time)</span>
                      <input
                        type="datetime-local"
                        value={deadlineDraft}
                        onChange={(e) => setDeadlineDraft(e.target.value)}
                        className="input"
                        autoFocus
                      />
                    </label>
                    <button onClick={() => saveDeadline(ep.id, deadlineDraft)} disabled={busy} className="btn btn-primary btn-sm">
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                    {ep.lock_at && (
                      <button onClick={() => saveDeadline(ep.id, '')} disabled={busy} className="btn btn-secondary btn-sm">
                        Clear
                      </button>
                    )}
                    <button onClick={() => setEditingDeadline(null)} disabled={busy} className="btn btn-secondary btn-sm">
                      Cancel
                    </button>
                  </div>
                ) : null}

                {confirmDelete === ep.id ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 rounded-[12px] bg-terracotta-subtle">
                    <span className="text-sm text-terracotta flex-1">
                      Delete week {ep.week_number}? Its picks, results and scores go with it.
                    </span>
                    <button onClick={() => deleteEpisode(ep.id)} disabled={busy} className="btn btn-danger btn-sm">
                      {busy ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button onClick={() => setConfirmDelete(null)} disabled={busy} className="btn btn-secondary btn-sm">
                      Cancel
                    </button>
                  </div>
                ) : confirmLock === ep.id ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 rounded-[12px] bg-terracotta-subtle">
                    <span className="text-sm text-terracotta flex-1">
                      Lock week {ep.week_number}? Nobody can change their picks after this.
                    </span>
                    <button onClick={() => setStatus(ep.id, 'locked')} disabled={busy} className="btn btn-danger btn-sm">
                      {busy ? 'Locking…' : 'Yes, lock picks'}
                    </button>
                    <button onClick={() => setConfirmLock(null)} disabled={busy} className="btn btn-secondary btn-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ep.status === 'upcoming' && (
                      <button onClick={() => setStatus(ep.id, 'open')} disabled={busy} className="btn btn-primary btn-sm">
                        <Radio size={13} /> Open Picks
                      </button>
                    )}
                    {ep.status === 'open' && (
                      <button onClick={() => setConfirmLock(ep.id)} disabled={busy} className="btn btn-danger btn-sm">
                        <Lock size={13} /> Lock Picks
                      </button>
                    )}
                    {ep.status === 'locked' && (
                      <>
                        <Link href={`/admin/results/${ep.week_number}`} className="btn btn-primary btn-sm">
                          <ClipboardCheck size={13} /> Enter Results
                        </Link>
                        <button onClick={() => setStatus(ep.id, 'open')} disabled={busy} className="btn btn-secondary btn-sm">
                          <Unlock size={13} /> Reopen
                        </button>
                      </>
                    )}
                    {ep.status === 'scored' && (
                      <Link href={`/episodes/${ep.week_number}`} className="btn btn-secondary btn-sm">
                        <Eye size={13} /> View
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setEditingDeadline(editing ? null : ep.id);
                        setDeadlineDraft(toDatetimeLocalValue(ep.lock_at));
                      }}
                      disabled={busy}
                      className="btn btn-secondary btn-sm"
                    >
                      <Clock size={13} /> {ep.lock_at ? 'Edit deadline' : 'Set deadline'}
                    </button>
                    <button onClick={() => setConfirmDelete(ep.id)} disabled={busy} className="btn btn-danger btn-sm ml-auto">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
