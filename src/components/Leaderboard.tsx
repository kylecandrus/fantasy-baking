'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, getPlayerColor } from '@/lib/types';
import { Crown } from 'lucide-react';

interface LeaderboardEntry {
  player: Player;
  total: number;
  weekly: number;
  rank: number;
  tied: boolean;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Standard competition ranking (1, 2, 2, 4, ...) so tied players share a
// rank instead of the sort order arbitrarily picking a "leader" among them.
function rankEntries(rows: { player: Player; total: number; weekly: number }[]): LeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  let currentRank = 0;
  const ranked = sorted.map((row, i) => {
    if (i === 0 || row.total !== sorted[i - 1].total) currentRank = i + 1;
    return { ...row, rank: currentRank };
  });
  return ranked.map((row) => ({ ...row, tied: ranked.filter((r) => r.rank === row.rank).length > 1 }));
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

      const ranked = rankEntries(
        players.map((player) => ({ player, total: totals[player.id] || 0, weekly: weekly[player.id] || 0 }))
      );

      setEntries(ranked);
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

  const hasScores = entries[0].total > 0;
  const leaders = hasScores ? entries.filter((e) => e.rank === 1) : [entries[0]];
  const rest = entries.slice(leaders.length);
  const topTotal = entries[0].total;

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

      {/* Leader(s) — the page within the page */}
      <div className="space-y-2">
        {leaders.map((entry) => {
          const leaderColor = getPlayerColor(entry.player.color);
          return (
            <div
              key={entry.player.id}
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
                {getInitials(entry.player.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="eyebrow text-amber-dark">
                    {hasScores ? (leaders.length > 1 ? 'Tied for 1st' : '1st place') : 'No scores yet'}
                  </span>
                </div>
                <p className="font-display text-xl md:text-2xl text-ink leading-tight truncate">
                  {entry.player.name}
                </p>
                {hasScores && entry.weekly !== 0 && (
                  <p className="text-xs text-ink-secondary mt-0.5 tabular-nums">
                    {entry.weekly > 0 ? '+' : ''}{entry.weekly} this week
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-3xl md:text-4xl text-ink leading-none tabular-nums">
                  {entry.total}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mt-1">
                  points
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of the field */}
      {rest.length > 0 && (
        <ul className="divide-y divide-border/60">
          {rest.map((entry) => {
            const color = getPlayerColor(entry.player.color);
            const gap = topTotal - entry.total;
            return (
              <li key={entry.player.id} className="flex items-center gap-3 py-2.5 px-2">
                <span className="w-8 text-xs font-semibold text-ink-muted tabular-nums text-right">
                  {entry.tied ? `T-${entry.rank}` : entry.rank}
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
