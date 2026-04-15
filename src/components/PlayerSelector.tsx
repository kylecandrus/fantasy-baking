'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/lib/types';
import { usePlayer } from '@/hooks/usePlayer';
import { User, ChevronDown } from 'lucide-react';

const PLAYER_COLORS: Record<string, string> = {
  Kyle: 'bg-amber-subtle text-amber-dark border-amber/20',
  Erika: 'bg-terracotta-subtle text-terracotta border-terracotta/20',
  Brian: 'bg-sage-subtle text-sage border-sage/20',
  Jill: 'bg-amber-subtle text-amber-dark border-amber/20',
};

const PLAYER_INITIALS_BG: Record<string, string> = {
  Kyle: 'bg-amber text-white',
  Erika: 'bg-terracotta text-white',
  Brian: 'bg-sage text-white',
  Jill: 'bg-amber-dark text-white',
};

export default function PlayerSelector({ compact = false }: { compact?: boolean }) {
  const { playerId, setPlayerId, loaded } = usePlayer();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => {
      if (data) setPlayers(data);
    });
  }, []);

  useEffect(() => {
    if (playerId && players.length > 0) {
      setSelectedPlayer(players.find((p) => p.id === playerId) || null);
    }
  }, [playerId, players]);

  if (!loaded) return null;

  if (selectedPlayer) {
    if (compact) {
      return (
        <button
          onClick={() => setPlayerId(null)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors hover:opacity-80 ${PLAYER_COLORS[selectedPlayer.name] || 'bg-cream-dark text-ink border-border'}`}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${PLAYER_INITIALS_BG[selectedPlayer.name] || 'bg-ink-muted text-white'}`}>
            {selectedPlayer.name[0]}
          </div>
          {selectedPlayer.name}
          <ChevronDown size={12} />
        </button>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${PLAYER_COLORS[selectedPlayer.name] || 'bg-cream-dark text-ink border-border'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${PLAYER_INITIALS_BG[selectedPlayer.name] || 'bg-ink-muted text-white'}`}>
            {selectedPlayer.name[0]}
          </div>
          <span className="font-semibold">{selectedPlayer.name}</span>
        </div>
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
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => setPlayerId(player.id)}
            className="card card-interactive p-4 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${PLAYER_INITIALS_BG[player.name] || 'bg-ink-muted text-white'}`}>
              {player.name[0]}
            </div>
            <span className="font-semibold text-ink text-left">{player.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
