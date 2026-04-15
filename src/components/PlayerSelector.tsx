'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, PLAYER_COLORS, getPlayerColor } from '@/lib/types';
import { usePlayer } from '@/hooks/usePlayer';
import { User, ChevronDown, Palette } from 'lucide-react';

export default function PlayerSelector({ compact = false }: { compact?: boolean }) {
  const { playerId, setPlayerId, loaded } = usePlayer();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => {
      if (data) setPlayers(data);
    });
  }, []);

  useEffect(() => {
    if (playerId && players.length > 0) {
      setSelectedPlayer(players.find((p) => p.id === playerId) || null);
    } else {
      setSelectedPlayer(null);
    }
  }, [playerId, players]);

  async function changeColor(colorKey: string) {
    if (!selectedPlayer) return;
    await supabase.from('players').update({ color: colorKey }).eq('id', selectedPlayer.id);
    const updated = { ...selectedPlayer, color: colorKey as Player['color'] };
    setSelectedPlayer(updated);
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setShowColorPicker(false);
  }

  if (!loaded) return null;

  if (selectedPlayer) {
    const color = getPlayerColor(selectedPlayer.color);

    if (compact) {
      return (
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-sm font-medium transition-colors hover:border-ink-faint"
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: color.bg, color: color.text }}>
              {selectedPlayer.name[0]}
            </span>
            {selectedPlayer.name}
            <ChevronDown size={12} className="text-ink-muted" />
          </button>
          {showColorPicker && (
            <div className="absolute right-0 top-full mt-2 z-50 card p-3 w-56 animate-fade-up">
              <p className="text-xs font-medium text-ink-muted mb-2">Your color</p>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => changeColor(c.key)}
                    className={`w-8 h-8 rounded-full transition-all ${selectedPlayer.color === c.key ? 'ring-2 ring-offset-2 ring-ink-muted scale-110' : 'hover:scale-105'}`}
                    style={{ background: c.bg }}
                    title={c.label}
                  />
                ))}
              </div>
              <button
                onClick={() => { setPlayerId(null); setShowColorPicker(false); }}
                className="text-xs text-ink-muted hover:text-ink underline underline-offset-2 w-full text-center"
              >
                Switch player
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl border border-border bg-surface">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: color.bg, color: color.text }}>
            {selectedPlayer.name[0]}
          </span>
          <span className="font-semibold text-ink">{selectedPlayer.name}</span>
        </div>
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-cream-dark transition-colors"
          title="Change color"
        >
          <Palette size={16} />
        </button>
        <button
          onClick={() => setPlayerId(null)}
          className="text-sm text-ink-muted hover:text-ink underline underline-offset-2"
        >
          Switch
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6 text-center animate-fade-up">
      <div className="w-12 h-12 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-3">
        <User size={22} className="text-ink-muted" />
      </div>
      <h2 className="font-display text-xl text-ink mb-1">Who&apos;s playing?</h2>
      <p className="text-sm text-ink-muted mb-5">Select your name to get started</p>
      <div className="grid grid-cols-2 gap-2.5">
        {players.map((player) => {
          const color = getPlayerColor(player.color);
          return (
            <button
              key={player.id}
              onClick={() => setPlayerId(player.id)}
              className="card card-interactive p-4 flex items-center gap-3"
            >
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: color.bg, color: color.text }}>
                {player.name[0]}
              </span>
              <span className="font-semibold text-ink text-left">{player.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
