'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, getPlayerColor } from '@/lib/types';
import { Crown } from 'lucide-react';

interface LeaderboardEntry {
  player: Player;
  total: number;
  weekly: number;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Leaderboard({ compact = false }: { compact?: boolean }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: players }, { data: scores }, { data: scoredEpisodes }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('scores').select('*'),
        supabase.from('episodes').select('id, week_number').eq('status', 'scored').order('week_number', { ascending: false }).limit(1),
      ]);

      if (!players) { setLoading(false); return; }

      const totals: Record<string, number> = {};
      const weekly: Record<string, number> = {};
      const latestEpId = scoredEpisodes?.[0]?.id;

      players.forEach((p) => { totals[p.id] = 0; weekly[p.id] = 0; });
      scores?.forEach((s) => {
        totals[s.player_id] = (totals[s.player_id] || 0) + s.points;
        if (latestEpId && s.episode_id === latestEpId) {
          weekly[s.player_id] = (weekly[s.player_id] || 0) + s.points;
        }
      });

      const sorted = players
        .map((player) => ({ player, total: totals[player.id] || 0, weekly: weekly[player.id] || 0 }))
        .sort((a, b) => b.total - a.total);

      setEntries(sorted);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {!compact && <div className="skeleton h-4 w-24" />}
        <div className="skeleton h-20 w-full" />
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-3">
        {!compact && (
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-amber" />
            <h2 className="eyebrow">Standings</h2>
          </div>
        )}
        <p className="text-center text-ink-muted text-sm py-6">The judges haven&apos;t scored yet.</p>
      </div>
    );
  }

  const [leader, ...rest] = entries;
  const hasScores = leader.total > 0;
  const leaderColor = getPlayerColor(leader.player.color);

  return (
    <section className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-amber" />
            <h2 className="eyebrow">Standings</h2>
          </div>
        </div>
      )}

      {/* Leader — the page within the page */}
      <div
        className="relative rounded-[16px] p-4 md:p-5 flex items-center gap-4 overflow-hidden"
        style={{
          background: hasScores
            ? `linear-gradient(135deg, ${leaderColor.bg}14 0%, var(--color-amber-subtle) 100%)`
            : 'var(--color-cream-dark)',
        }}
      >
        <span
          className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-base font-bold shrink-0 shadow-sm"
          style={{ background: leaderColor.bg, color: leaderColor.text }}
        >
          {getInitials(leader.player.name)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="eyebrow text-amber-dark">
              {hasScores ? '1st place' : 'No scores yet'}
            </span>
          </div>
          <p className="font-display text-xl md:text-2xl text-ink leading-tight truncate">
            {leader.player.name}
          </p>
          {hasScores && leader.weekly !== 0 && (
            <p className="text-xs text-ink-secondary mt-0.5 tabular-nums">
              {leader.weekly > 0 ? '+' : ''}{leader.weekly} this week
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-3xl md:text-4xl text-ink leading-none tabular-nums">
            {leader.total}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mt-1">
            points
          </div>
        </div>
      </div>

      {/* Rest of the field */}
      {rest.length > 0 && (
        <ul className="divide-y divide-border/60">
          {rest.map((entry, i) => {
            const color = getPlayerColor(entry.player.color);
            const rank = i + 2;
            const gap = leader.total - entry.total;
            return (
              <li key={entry.player.id} className="flex items-center gap-3 py-2.5 px-2">
                <span className="w-5 text-xs font-semibold text-ink-muted tabular-nums text-right">
                  {rank}
                </span>
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: color.bg, color: color.text }}
                >
                  {getInitials(entry.player.name)}
                </span>
                <span className="font-medium text-ink flex-1 truncate">{entry.player.name}</span>
                {hasScores && gap > 0 && (
                  <span className="text-xs text-ink-faint tabular-nums">−{gap}</span>
                )}
                <span className="font-semibold tabular-nums text-ink min-w-[2rem] text-right">
                  {entry.total}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
