'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, Episode, CATEGORIES, WINNER_GUESS_CATEGORY, getPlayerColor } from '@/lib/types';
import { Crown, ChevronDown } from 'lucide-react';
import SpoilerGate from '@/components/SpoilerGate';
import { useWatched, visibleScores } from '@/hooks/useWatched';

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

interface RankedPlayer {
  player: Player;
  total: number;
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
function rankPlayers(playerList: Player[], totals: Record<string, number>): RankedPlayer[] {
  const sorted = [...playerList].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  let currentRank = 0;
  const ranked = sorted.map((player, i) => {
    const total = totals[player.id] || 0;
    const prevTotal = i > 0 ? (totals[sorted[i - 1].id] || 0) : null;
    if (i === 0 || total !== prevTotal) currentRank = i + 1;
    return { player, total, rank: currentRank };
  });
  return ranked.map((r) => ({ ...r, tied: ranked.filter((x) => x.rank === r.rank).length > 1 }));
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [rawScores, setRawScores] = useState<ScoreRow[]>([]);
  const [scoredEpisodes, setScoredEpisodes] = useState<Episode[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { isWatched, markWatched } = useWatched();

  useEffect(() => {
    async function load() {
      const [playersRes, episodesRes, scoresRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('episodes').select('*').eq('status', 'scored').order('week_number'),
        supabase.from('scores').select('*'),
      ]);

      setPlayers(playersRes.data || []);
      setScoredEpisodes(episodesRes.data || []);
      setRawScores(scoresRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  // Spoiler guard: everything below is built only from weeks this viewer has watched.
  const unwatched = scoredEpisodes.filter((e) => !isWatched(e.week_number));
  const { episodes, allScores, weekScores, totals } = useMemo(() => {
    const episodes = scoredEpisodes.filter((e) => isWatched(e.week_number));
    const allScores = visibleScores(rawScores, scoredEpisodes, isWatched);

    const weekScores: WeekScore[] = episodes.map((ep) => {
      const scores: Record<string, number> = {};
      players.forEach((p) => (scores[p.id] = 0));
      allScores
        .filter((s) => s.episode_id === ep.id)
        .forEach((s) => (scores[s.player_id] = (scores[s.player_id] || 0) + s.points));
      return { episode: ep, scores };
    });

    const totals: Record<string, number> = {};
    players.forEach((p) => (totals[p.id] = 0));
    allScores.forEach((s) => (totals[s.player_id] = (totals[s.player_id] || 0) + s.points));

    return { episodes, allScores, weekScores, totals };
  }, [players, rawScores, scoredEpisodes, isWatched]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-24 w-full" />
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
      </div>
    );
  }

  const ranked = rankPlayers(players, totals);
  const hasScores = ranked.length > 0 && ranked[0].total > 0;
  // Before anyone has points there's no leader to crown and no ranks to show.
  const leaders = hasScores ? ranked.filter((r) => r.rank === 1) : [];
  const rest = ranked.slice(leaders.length);
  const topTotal = ranked[0]?.total || 0;

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
          {hasScores
            ? `Through ${weekScores.length} ${weekScores.length === 1 ? 'episode' : 'episodes'}`
            : unwatched.length > 0
              ? 'Nothing to show until you catch up.'
              : 'Waiting on the first scored episode.'}
        </p>
      </header>

      {unwatched.length > 0 && (
        <SpoilerGate compact weeks={[unwatched[0].week_number]} onReveal={() => markWatched(unwatched[0].week_number)} />
      )}

      {/* Leader callout(s) */}
      {leaders.length > 0 && (
        <div className="space-y-3">
          {leaders.map((entry) => {
            const leaderColor = getPlayerColor(entry.player.color);
            return (
              <div
                key={entry.player.id}
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
                  {getInitials(entry.player.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Crown size={12} className="text-amber" />
                    <span className="eyebrow text-amber-dark">
                      {hasScores ? (leaders.length > 1 ? 'Tied for the lead' : 'In the lead') : 'No scores yet'}
                    </span>
                  </div>
                  <p className="font-display text-2xl md:text-3xl text-ink leading-tight truncate">
                    {entry.player.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-4xl md:text-5xl text-ink leading-none tabular-nums">
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
      )}

      {/* Overall standings list */}
      {rest.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">{hasScores ? 'The rest of the field' : 'The field'}</h2>
          <ul className="divide-y divide-border/60">
            {rest.map((entry) => {
              const color = getPlayerColor(entry.player.color);
              const isExpanded = expandedPlayer === entry.player.id;
              const gap = topTotal - entry.total;
              return (
                <li key={entry.player.id}>
                  <button
                    onClick={() => setExpandedPlayer(isExpanded ? null : entry.player.id)}
                    className="w-full flex items-center gap-3 py-3 px-2 hover:bg-cream/60 rounded-md transition-colors text-left"
                  >
                    <span className="w-8 text-xs font-semibold text-ink-muted tabular-nums text-right">
                      {!hasScores ? '–' : entry.tied ? `T-${entry.rank}` : entry.rank}
                    </span>
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: color.bg, color: color.text }}
                    >
                      {getInitials(entry.player.name)}
                    </span>
                    <span className="font-medium text-ink flex-1 truncate">{entry.player.name}</span>
                    {hasScores && gap > 0 && (
                      <span className="text-xs text-ink-faint tabular-nums">−{gap}</span>
                    )}
                    <span className="font-semibold tabular-nums text-ink min-w-[2.5rem] text-right">
                      {entry.total}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-ink-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-10 mr-2 mb-2 rounded-[12px] bg-cream-dark/60 overflow-hidden">
                      {renderBreakdown(entry.player)}
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
                  {ranked.map((entry, pi) => (
                    <tr key={entry.player.id} className={pi < ranked.length - 1 ? 'border-b border-border/40' : ''}>
                      <td className="p-3 pl-4 sticky left-0 bg-surface z-10">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getPlayerColor(entry.player.color).bg }} />
                          <span className={`text-ink ${entry.rank === 1 ? 'font-bold' : 'font-medium'} truncate`}>{entry.player.name}</span>
                        </div>
                      </td>
                      {weekScores.map((ws) => {
                        const pts = ws.scores[entry.player.id] || 0;
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
                        <span className={`tabular-nums ${entry.rank === 1 ? 'font-bold text-ink' : 'font-semibold text-ink-secondary'}`}>
                          {entry.total}
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
