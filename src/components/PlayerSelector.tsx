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
  const [pinPromptPlayer, setPinPromptPlayer] = useState<Player | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

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

  function handlePlayerClick(player: Player) {
    if (player.pin) {
      setPinPromptPlayer(player);
      setPinInput('');
      setPinError(false);
    } else {
      setPlayerId(player.id);
    }
  }

  function handlePinSubmit() {
    if (!pinPromptPlayer) return;
    if (pinInput === pinPromptPlayer.pin) {
      setPlayerId(pinPromptPlayer.id);
      setPinPromptPlayer(null);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
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
                {PLAYER_COLORS.map((c) => {
                  const takenBy = players.find((p) => p.id !== selectedPlayer.id && p.color === c.key);
                  return (
                    <button
                      key={c.key}
                      onClick={() => !takenBy && changeColor(c.key)}
                      disabled={!!takenBy}
                      className={`w-8 h-8 rounded-full transition-all ${
                        selectedPlayer.color === c.key
                          ? 'ring-2 ring-offset-2 ring-ink-muted scale-110'
                          : takenBy
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:scale-105'
                      }`}
                      style={{ background: c.bg }}
                      title={takenBy ? `Taken by ${takenBy.name}` : c.label}
                    />
                  );
                })}
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
      <div className="relative flex items-center gap-3">
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
        {showColorPicker && (
          <div className="absolute left-0 top-full mt-2 z-50 card p-3 w-56 animate-fade-up">
            <p className="text-xs font-medium text-ink-muted mb-2">Your color</p>
            <div className="grid grid-cols-5 gap-1.5">
              {PLAYER_COLORS.map((c) => {
                const takenBy = players.find((p) => p.id !== selectedPlayer.id && p.color === c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => !takenBy && changeColor(c.key)}
                    disabled={!!takenBy}
                    className={`w-8 h-8 rounded-full transition-all ${
                      selectedPlayer.color === c.key
                        ? 'ring-2 ring-offset-2 ring-ink-muted scale-110'
                        : takenBy
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:scale-105'
                    }`}
                    style={{ background: c.bg }}
                    title={takenBy ? `Taken by ${takenBy.name}` : c.label}
                  />
                );
              })}
            </div>
          </div>
        )}
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
              onClick={() => handlePlayerClick(player)}
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

      {pinPromptPlayer && (
        <div className="mt-4 p-4 rounded-xl border border-border bg-surface animate-fade-up">
          <p className="text-sm font-medium text-ink mb-2">Enter PIN for {pinPromptPlayer.name}</p>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm text-center tracking-widest ${pinError ? 'border-red-300 bg-red-50' : 'border-border bg-cream'}`}
              placeholder="••••"
              autoFocus
            />
            <button onClick={handlePinSubmit} className="btn btn-primary btn-sm">Go</button>
            <button onClick={() => setPinPromptPlayer(null)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
          {pinError && <p className="text-xs text-red-600 mt-1">Wrong PIN. Try again.</p>}
        </div>
      )}
    </div>
  );
}
