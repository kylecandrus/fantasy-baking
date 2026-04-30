'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, Episode, CATEGORIES, WINNER_GUESS_CATEGORY, getPlayerColor } from '@/lib/types';
import { Crown, ChevronDown } from 'lucide-react';

interface WeekScore {
  episode: Episode;
  scores: Record<string, number>;
}

interface ScoreRow {
  player_id: string;
  episode_id: string;
  category: string;
  points: number;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [weekScores, setWeekScores] = useState<WeekScore[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [allScores, setAllScores] = useState<ScoreRow[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [playersRes, episodesRes, scoresRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('episodes').select('*').eq('status', 'scored').order('week_number'),
        supabase.from('scores').select('*'),
      ]);

      const playerList = playersRes.data || [];
      const episodeList = episodesRes.data || [];
      const scoreList: ScoreRow[] = scoresRes.data || [];

      setPlayers(playerList);
      setEpisodes(episodeList);
      setAllScores(scoreList);

      const weeks: WeekScore[] = episodeList.map((ep) => {
        const epScores = scoreList.filter((s) => s.episode_id === ep.id);
        const scores: Record<string, number> = {};
        playerList.forEach((p) => (scores[p.id] = 0));
        epScores.forEach((s) => (scores[s.player_id] = (scores[s.player_id] || 0) + s.points));
        return { episode: ep, scores };
      });
      setWeekScores(weeks);

      const t: Record<string, number> = {};
      playerList.forEach((p) => (t[p.id] = 0));
      scoreList.forEach((s) => (t[s.player_id] = (t[s.player_id] || 0) + s.points));
      setTotals(t);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-24 w-full" />
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  const leader = sortedPlayers[0];
  const rest = sortedPlayers.slice(1);
  const hasScores = leader && (totals[leader.id] || 0) > 0;
  const leaderColor = leader ? getPlayerColor(leader.color) : null;

  const renderBreakdown = (player: Player) => {
    const playerScores = allScores.filter((s) => s.player_id === player.id);
    if (playerScores.length === 0) {
      return (
        <div className="px-3 py-2 text-xs text-ink-muted">No scores yet.</div>
      );
    }
    return (
      <div className="space-y-2 py-2">
        {episodes.map((ep) => {
          const epScores = playerScores.filter((s) => s.episode_id === ep.id);
          if (epScores.length === 0) return null;
          const weekTotal = epScores.reduce((sum, s) => sum + s.points, 0);
          const allCats = ep.winner_guess_points
            ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: ep.winner_guess_points }]
            : CATEGORIES;
          return (
            <div key={ep.id} className="px-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-ink-secondary">
                  Week {ep.week_number} <span className="text-ink-muted font-normal">— {ep.theme}</span>
                </span>
                <span className={`text-xs font-bold tabular-nums ${weekTotal > 0 ? 'text-sage' : weekTotal < 0 ? 'text-terracotta' : 'text-ink-muted'}`}>
                  {weekTotal > 0 ? '+' : ''}{weekTotal}
                </span>
              </div>
              <div className="space-y-0.5 pl-2 border-l-2 border-border">
                {epScores.map((s) => {
                  const cat = allCats.find((c) => c.key === s.category);
                  return (
                    <div key={s.category} className="flex items-center justify-between text-xs px-2 py-0.5">
                      <span className="text-ink-secondary">{cat?.label || s.category}</span>
                      <span className={`font-medium tabular-nums ${s.points > 0 ? 'text-sage' : s.points < 0 ? 'text-terracotta' : 'text-ink-faint'}`}>
                        {s.points > 0 ? '+' : ''}{s.points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl md:text-[2.25rem] text-ink leading-tight">Standings</h1>
        <p className="text-ink-secondary mt-1 text-sm">
          {hasScores ? `Through ${weekScores.length} ${weekScores.length === 1 ? 'episode' : 'episodes'}` : 'Waiting on the first scored episode.'}
        </p>
      </header>

      {/* Leader callout */}
      {leader && leaderColor && (
        <div
          className="relative rounded-[20px] p-5 md:p-6 flex items-center gap-4 overflow-hidden"
          style={{
            background: hasScores
              ? `linear-gradient(135deg, ${leaderColor.bg}1A 0%, var(--color-amber-subtle) 100%)`
              : 'var(--color-cream-dark)',
          }}
        >
          <span
            className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-sm"
            style={{ background: leaderColor.bg, color: leaderColor.text }}
          >
            {getInitials(leader.name)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Crown size={12} className="text-amber" />
              <span className="eyebrow text-amber-dark">
                {hasScores ? 'In the lead' : 'No scores yet'}
              </span>
            </div>
            <p className="font-display text-2xl md:text-3xl text-ink leading-tight truncate">
              {leader.name}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-4xl md:text-5xl text-ink leading-none tabular-nums">
              {totals[leader.id] || 0}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mt-1">
              points
            </div>
          </div>
        </div>
      )}

      {/* Overall standings list */}
      {rest.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">The rest of the field</h2>
          <ul className="divide-y divide-border/60">
            {rest.map((player, i) => {
              const color = getPlayerColor(player.color);
              const rank = i + 2;
              const isExpanded = expandedPlayer === player.id;
              const gap = (totals[leader!.id] || 0) - (totals[player.id] || 0);
              return (
                <li key={player.id}>
                  <button
                    onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                    className="w-full flex items-center gap-3 py-3 px-2 hover:bg-cream/60 rounded-md transition-colors text-left"
                  >
                    <span className="w-5 text-xs font-semibold text-ink-muted tabular-nums text-right">
                      {rank}
                    </span>
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: color.bg, color: color.text }}
                    >
                      {getInitials(player.name)}
                    </span>
                    <span className="font-medium text-ink flex-1 truncate">{player.name}</span>
                    {hasScores && gap > 0 && (
                      <span className="text-xs text-ink-faint tabular-nums">−{gap}</span>
                    )}
                    <span className="font-semibold tabular-nums text-ink min-w-[2.5rem] text-right">
                      {totals[player.id] || 0}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-ink-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-10 mr-2 mb-2 rounded-[12px] bg-cream-dark/60 overflow-hidden">
                      {renderBreakdown(player)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Week-by-week breakdown */}
      {weekScores.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow">Week by week</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 pl-4 eyebrow sticky left-0 bg-surface z-10">Player</th>
                    {weekScores.map((ws) => (
                      <th key={ws.episode.id} className="text-center px-2 py-3 eyebrow">
                        W{ws.episode.week_number}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 eyebrow text-ink">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player, pi) => (
                    <tr key={player.id} className={pi < sortedPlayers.length - 1 ? 'border-b border-border/40' : ''}>
                      <td className="p-3 pl-4 sticky left-0 bg-surface z-10">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getPlayerColor(player.color).bg }} />
                          <span className={`text-ink ${pi === 0 ? 'font-bold' : 'font-medium'} truncate`}>{player.name}</span>
                        </div>
                      </td>
                      {weekScores.map((ws) => {
                        const pts = ws.scores[player.id] || 0;
                        return (
                          <td key={ws.episode.id} className="text-center px-2 py-3">
                            <span className={`tabular-nums ${
                              pts > 0 ? 'text-sage font-medium' : pts < 0 ? 'text-terracotta font-medium' : 'text-ink-faint'
                            }`}>
                              {pts > 0 ? `+${pts}` : pts === 0 ? '—' : pts}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-center px-3 py-3">
                        <span className={`tabular-nums ${pi === 0 ? 'font-bold text-ink' : 'font-semibold text-ink-secondary'}`}>
                          {totals[player.id] || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {weekScores.length === 0 && (
        <div className="rounded-[12px] bg-cream-dark/60 p-8 text-center">
          <p className="text-ink-secondary text-sm">The judges haven&apos;t scored yet. Check back after the first episode.</p>
        </div>
      )}
    </div>
  );
}
