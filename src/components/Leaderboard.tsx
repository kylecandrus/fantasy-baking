'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, getPlayerColor } from '@/lib/types';
import { Crown, Medal } from 'lucide-react';

interface LeaderboardEntry {
  player: Player;
  total: number;
}

const RANK_BG = [
  'bg-amber-subtle border-amber/25',
  'bg-cream-dark border-border',
  'bg-cream-dark border-border',
  'bg-surface border-border',
];

export default function Leaderboard({ compact = false }: { compact?: boolean }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: players } = await supabase.from('players').select('*').order('name');
      const { data: scores } = await supabase.from('scores').select('*');

      if (!players) { setLoading(false); return; }

      const totals: Record<string, number> = {};
      players.forEach((p) => (totals[p.id] = 0));
      scores?.forEach((s) => (totals[s.player_id] = (totals[s.player_id] || 0) + s.points));

      const sorted = players
        .map((player) => ({ player, total: totals[player.id] || 0 }))
        .sort((a, b) => b.total - a.total);

      setEntries(sorted);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className={compact ? '' : 'card'}>
        {!compact && (
          <div className="px-5 py-4 border-b border-border">
            <div className="skeleton h-6 w-28" />
          </div>
        )}
        <div className={`${compact ? '' : 'p-4'} space-y-2`}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={compact ? '' : 'card'}>
        {!compact && (
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Crown size={18} className="text-amber" />
            <h2 className="font-display text-lg text-ink">Standings</h2>
          </div>
        )}
        <div className={compact ? 'py-4' : 'p-6'}>
          <p className="text-center text-ink-muted text-sm">No scores yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'card overflow-hidden'}>
      {!compact && (
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Crown size={18} className="text-amber" />
          <h2 className="font-display text-lg text-ink">Standings</h2>
        </div>
      )}
      <div className={`${compact ? '' : 'p-3'} space-y-1.5 stagger`}>
        {entries.map((entry, i) => {
          const color = getPlayerColor(entry.player.color);
          return (
            <div
              key={entry.player.id}
              className={`flex items-center gap-3 p-3 rounded-xl border ${RANK_BG[i] || RANK_BG[3]}`}
            >
              <div className="w-7 text-center shrink-0">
                {i === 0 ? (
                  <Medal size={18} className="text-amber mx-auto" />
                ) : (
                  <span className="text-sm font-semibold text-ink-muted">{i + 1}</span>
                )}
              </div>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: color.bg, color: color.text }}>
                {entry.player.name[0]}
              </span>
              <span className="font-semibold text-ink flex-1">{entry.player.name}</span>
              <span className={`font-bold tabular-nums ${i === 0 ? 'text-amber-dark text-lg' : 'text-ink-secondary'}`}>
                {entry.total}
                <span className="text-ink-muted font-normal text-xs ml-0.5">pts</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
