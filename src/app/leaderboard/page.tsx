'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, Episode, Contestant, CATEGORIES, WINNER_GUESS_CATEGORY, getPlayerColor } from '@/lib/types';
import { Crown, Medal, ChevronDown } from 'lucide-react';

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
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  const RANK_BG = ['bg-amber-subtle border-amber/20', 'bg-cream-dark border-border', 'bg-cream-dark border-border', 'bg-surface border-border'];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Standings</h1>

      {/* Overall standings */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Crown size={18} className="text-amber" />
          <h2 className="font-display text-lg text-ink">Overall</h2>
        </div>
        <div className="p-3 space-y-1.5 stagger">
          {sortedPlayers.map((player, i) => {
            const isExpanded = expandedPlayer === player.id;
            const playerScores = allScores.filter((s) => s.player_id === player.id);
            return (
              <div key={player.id}>
                <button
                  onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border w-full text-left transition-colors ${RANK_BG[i] || RANK_BG[3]}`}
                >
                  <div className="w-7 text-center shrink-0">
                    {i === 0 && (totals[player.id] || 0) > 0 ? (
                      <Medal size={18} className="text-amber mx-auto" />
                    ) : (
                      <span className="text-sm font-semibold text-ink-muted">{i + 1}</span>
                    )}
                  </div>
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: getPlayerColor(player.color).bg, color: '#fff' }}>
                    {player.name[0]}
                  </span>
                  <span className="font-semibold text-ink flex-1">{player.name}</span>
                  <span className={`font-bold text-lg tabular-nums ${i === 0 ? 'text-amber-dark' : 'text-ink'}`}>
                    {totals[player.id] || 0}
                    <span className="text-ink-secondary font-medium text-xs ml-0.5">pts</span>
                  </span>
                  <ChevronDown size={14} className={`text-ink-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && playerScores.length > 0 && (
                  <div className="mt-1 ml-10 mr-2 mb-1 rounded-lg bg-cream/60 border border-border/50 overflow-hidden">
                    {episodes.map((ep) => {
                      const epScores = playerScores.filter((s) => s.episode_id === ep.id);
                      if (epScores.length === 0) return null;
                      const weekTotal = epScores.reduce((sum, s) => sum + s.points, 0);
                      const allCats = ep.winner_guess_points
                        ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: ep.winner_guess_points }]
                        : CATEGORIES;
                      return (
                        <div key={ep.id} className="px-3 py-2 border-b border-border/30 last:border-b-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-ink-muted">Week {ep.week_number} — {ep.theme}</span>
                            <span className={`text-xs font-bold tabular-nums ${weekTotal > 0 ? 'text-sage' : weekTotal < 0 ? 'text-terracotta' : 'text-ink-muted'}`}>
                              {weekTotal > 0 ? '+' : ''}{weekTotal}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {epScores.map((s) => {
                              const cat = allCats.find((c) => c.key === s.category);
                              return (
                                <div key={s.category} className="flex items-center justify-between text-xs">
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
                )}
                {isExpanded && playerScores.length === 0 && (
                  <div className="mt-1 ml-10 mr-2 mb-1 px-3 py-2 rounded-lg bg-cream/60 border border-border/50">
                    <p className="text-xs text-ink-muted">No scores yet.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Week-by-week breakdown */}
      {weekScores.length > 0 && (
        <div className="card overflow-hidden animate-fade-up">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-display text-lg text-ink">Week by Week</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 pl-4 font-semibold text-ink-muted text-xs uppercase tracking-wider sticky left-0 bg-surface z-10">Player</th>
                  {weekScores.map((ws) => (
                    <th key={ws.episode.id} className="text-center p-3 font-semibold text-ink-muted text-xs">
                      W{ws.episode.week_number}
                    </th>
                  ))}
                  <th className="text-center p-3 pr-4 font-bold text-ink text-xs uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player, pi) => (
                  <tr key={player.id} className={pi < sortedPlayers.length - 1 ? 'border-b border-border/50' : ''}>
                    <td className="p-3 pl-4 sticky left-0 bg-surface z-10">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getPlayerColor(player.color).bg }} />
                        <span className="font-semibold text-ink">{player.name}</span>
                      </div>
                    </td>
                    {weekScores.map((ws) => {
                      const pts = ws.scores[player.id] || 0;
                      return (
                        <td key={ws.episode.id} className="text-center p-3">
                          <span className={`inline-flex items-center gap-0.5 tabular-nums ${
                            pts > 0 ? 'text-sage font-medium' : pts < 0 ? 'text-terracotta font-medium' : 'text-ink-faint'
                          }`}>
                            {pts > 0 ? `+${pts}` : pts === 0 ? '\u2014' : pts}
                          </span>
                        </td>
                      );
                    })}
                    <td className="text-center p-3 pr-4">
                      <span className="font-bold text-ink tabular-nums">{totals[player.id] || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {weekScores.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-ink-muted text-sm">No episodes scored yet. Check back after the first episode!</p>
        </div>
      )}
    </div>
  );
}
