'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, Episode } from '@/lib/types';
import { Crown, Medal, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WeekScore {
  episode: Episode;
  scores: Record<string, number>;
}

const PLAYER_DOT: Record<string, string> = {
  Kyle: 'bg-amber',
  Erika: 'bg-terracotta',
  Brian: 'bg-sage',
  Jill: 'bg-amber-dark',
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [weekScores, setWeekScores] = useState<WeekScore[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [playersRes, episodesRes, scoresRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('episodes').select('*').eq('status', 'scored').order('week_number'),
        supabase.from('scores').select('*'),
      ]);

      const playerList = playersRes.data || [];
      const episodes = episodesRes.data || [];
      const allScores = scoresRes.data || [];

      setPlayers(playerList);

      const weeks: WeekScore[] = episodes.map((ep) => {
        const epScores = allScores.filter((s) => s.episode_id === ep.id);
        const scores: Record<string, number> = {};
        playerList.forEach((p) => (scores[p.id] = 0));
        epScores.forEach((s) => (scores[s.player_id] = (scores[s.player_id] || 0) + s.points));
        return { episode: ep, scores };
      });
      setWeekScores(weeks);

      const t: Record<string, number> = {};
      playerList.forEach((p) => (t[p.id] = 0));
      allScores.forEach((s) => (t[s.player_id] = (t[s.player_id] || 0) + s.points));
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
          {sortedPlayers.map((player, i) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 p-3.5 rounded-xl border ${RANK_BG[i] || RANK_BG[3]}`}
            >
              <div className="w-7 text-center shrink-0">
                {i === 0 ? (
                  <Medal size={18} className="text-amber mx-auto" />
                ) : (
                  <span className="text-sm font-semibold text-ink-muted">{i + 1}</span>
                )}
              </div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${PLAYER_DOT[player.name] || 'bg-ink-muted'}`}>
                {player.name[0]}
              </div>
              <span className="font-semibold text-ink flex-1">{player.name}</span>
              <span className={`font-bold text-lg tabular-nums ${i === 0 ? 'text-amber-dark' : 'text-ink'}`}>
                {totals[player.id] || 0}
                <span className="text-ink-muted font-normal text-xs ml-0.5">pts</span>
              </span>
            </div>
          ))}
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
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PLAYER_DOT[player.name] || 'bg-ink-muted'}`} />
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
