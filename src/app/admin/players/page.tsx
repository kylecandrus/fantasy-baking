'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, PLAYER_COLORS, getPlayerColor } from '@/lib/types';
import { useAdmin } from '@/hooks/usePlayer';
import { ArrowLeft, Plus, Trash2, AlertCircle, X } from 'lucide-react';

export default function AdminPlayersPage() {
  const { isAdmin, loaded } = useAdmin();
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlayers() {
    const { data, error: loadError } = await supabase.from('players').select('*').order('name');
    if (loadError) setError(`Couldn't load players: ${loadError.message}`);
    if (data) setPlayers(data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load-on-mount fetch
    loadPlayers();
  }, []);

  async function addPlayer() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    const { error: insertError } = await supabase.from('players').insert({ name: newName.trim(), color: 'amber' });
    if (insertError) {
      setError(`Couldn't add player: ${insertError.message}`);
      setAdding(false);
      return;
    }
    setNewName('');
    setAdding(false);
    await loadPlayers();
  }

  async function changeColor(player: Player, colorKey: string) {
    setError(null);
    const { error: updateError } = await supabase.from('players').update({ color: colorKey }).eq('id', player.id);
    if (updateError) {
      setError(`Couldn't update ${player.name}: ${updateError.message}`);
      return;
    }
    await loadPlayers();
  }

  async function deletePlayer(player: Player) {
    if (!confirm(`Delete ${player.name}? This will also delete all their picks and scores.`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from('players').delete().eq('id', player.id);
    if (deleteError) {
      setError(`Couldn't delete ${player.name}: ${deleteError.message}`);
      return;
    }
    await loadPlayers();
  }

  if (!loaded || loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }
  if (!isAdmin) return <div className="card p-8 text-center"><Link href="/admin" className="text-amber-dark underline">Login to admin</Link></div>;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-1">
          <ArrowLeft size={14} /> Admin
        </Link>
        <h1 className="font-display text-2xl text-ink">Players</h1>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-700 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-700 hover:text-red-900 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Add player */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-ink text-sm">Add Player</h3>
        <div className="flex gap-2">
          <label htmlFor="new-player-name" className="sr-only">Player name</label>
          <input
            id="new-player-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="Name"
            className="input flex-1"
          />
          <button onClick={addPlayer} disabled={adding || !newName.trim()} className="btn btn-primary btn-sm shrink-0">
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-ink text-sm">Players ({players.length})</h3>
        </div>
        {players.length === 0 ? (
          <div className="p-6 text-center text-ink-muted text-sm">No players yet.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {players.map((p) => {
              const color = getPlayerColor(p.color);
              return (
                <div key={p.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: color.bg, color: color.text }}>
                        {p.name[0]}
                      </span>
                      <div>
                        <span className="font-semibold text-ink">{p.name}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deletePlayer(p)}
                      aria-label={`Delete ${p.name}`}
                      className="p-1.5 rounded-lg text-ink-faint hover:text-terracotta hover:bg-terracotta-subtle transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 pl-12">
                    {PLAYER_COLORS.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => changeColor(p, c.key)}
                        aria-label={`Set ${p.name}'s color to ${c.label}`}
                        className={`w-6 h-6 rounded-full transition-all ${p.color === c.key ? 'ring-2 ring-offset-1 ring-ink-muted scale-110' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
                        style={{ background: c.bg }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
