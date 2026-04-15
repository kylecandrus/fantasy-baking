'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode, Pick, Result, Player, Contestant, CATEGORIES, WINNER_GUESS_CATEGORY, getPlayerColor } from '@/lib/types';
import { ArrowLeft, Target, Check, X, Minus, Clock, Lock } from 'lucide-react';

export default function EpisodeDetailPage() {
  const params = useParams();
  const weekNumber = Number(params.week);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [categoryScores, setCategoryScores] = useState<{ player_id: string; category: string; points: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: eps } = await supabase
        .from('episodes')
        .select('*')
        .eq('week_number', weekNumber)
        .limit(1);

      if (!eps || eps.length === 0) { setLoading(false); return; }
      const ep = eps[0];
      setEpisode(ep);

      const [picksRes, resultsRes, playersRes, contestantsRes, scoresRes] = await Promise.all([
        supabase.from('picks').select('*').eq('episode_id', ep.id),
        supabase.from('results').select('*').eq('episode_id', ep.id),
        supabase.from('players').select('*').order('name'),
        supabase.from('contestants').select('*').order('name'),
        supabase.from('scores').select('*').eq('episode_id', ep.id),
      ]);

      if (picksRes.data) setPicks(picksRes.data);
      if (resultsRes.data) setResults(resultsRes.data);
      if (playersRes.data) setPlayers(playersRes.data);
      if (contestantsRes.data) setContestants(contestantsRes.data);

      if (scoresRes.data) {
        const totals: Record<string, number> = {};
        scoresRes.data.forEach((s) => {
          totals[s.player_id] = (totals[s.player_id] || 0) + s.points;
        });
        setScores(totals);
        setCategoryScores(scoresRes.data);
      }

      setLoading(false);
    }
    load();
  }, [weekNumber]);

  const getContestantName = (id: string) => contestants.find((c) => c.id === id)?.name || '\u2014';
  const getPlayerPick = (playerId: string, category: string) => {
    const pick = picks.find((p) => p.player_id === playerId && p.category === category);
    return pick ? getContestantName(pick.contestant_id) : '\u2014';
  };
  const getResult = (category: string) => {
    const result = results.find((r) => r.category === category);
    return result ? getContestantName(result.contestant_id) : '\u2014';
  };
  const isCorrect = (playerId: string, category: string) => {
    const pick = picks.find((p) => p.player_id === playerId && p.category === category);
    const result = results.find((r) => r.category === category);
    if (!pick || !result) return null;
    return pick.contestant_id === result.contestant_id;
  };
  const getPickScore = (playerId: string, category: string) => {
    const score = categoryScores.find((s) => s.player_id === playerId && s.category === category);
    return score?.points ?? null;
  };
  const isLocked = (playerId: string, category: string) => {
    const pick = picks.find((p) => p.player_id === playerId && p.category === category);
    return !!pick?.locked;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="space-y-4">
        <Link href="/episodes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft size={14} /> Episodes
        </Link>
        <div className="card p-8 text-center text-ink-muted">Episode not found.</div>
      </div>
    );
  }

  const scored = episode.status === 'scored';
  const allCategories = episode?.winner_guess_points
    ? [...CATEGORIES, { ...WINNER_GUESS_CATEGORY, points: episode.winner_guess_points }]
    : CATEGORIES;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/episodes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-2">
          <ArrowLeft size={14} /> Episodes
        </Link>
        <h1 className="font-display text-2xl text-ink">{episode.theme}</h1>
        <p className="text-ink-muted text-sm mt-0.5">Week {episode.week_number}</p>
      </div>

      {episode.status === 'upcoming' && (
        <div className="card p-8 text-center animate-fade-up">
          <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-4">
            <Clock size={24} className="text-ink-muted" />
          </div>
          <h3 className="font-display text-xl text-ink mb-1">Coming Soon</h3>
          <p className="text-sm text-ink-muted">
            Picks will open before this episode airs.
          </p>
        </div>
      )}

      {/* Results + Picks Grid */}
      {(scored || results.length > 0) && (
        <div className="card overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 pl-4 font-semibold text-ink-muted text-xs uppercase tracking-wider">Category</th>
                  <th className="text-left p-3 font-semibold text-amber-dark text-xs uppercase tracking-wider">Actual</th>
                  {players.map((p) => (
                    <th key={p.id} className="text-left p-3 font-semibold text-ink text-xs uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: getPlayerColor(p.color).bg }} />
                        {p.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allCategories.map((cat, i) => (
                  <tr key={cat.key} className={i < allCategories.length - 1 ? 'border-b border-border/50' : ''}>
                    <td className="p-3 pl-4">
                      <div className="font-medium text-ink">{cat.label}</div>
                      <div className="text-xs text-ink-muted">{cat.points} pts</div>
                    </td>
                    <td className="p-3 font-semibold text-amber-dark">{getResult(cat.key)}</td>
                    {players.map((p) => {
                      const correct = isCorrect(p.id, cat.key);
                      const pickScore = getPickScore(p.id, cat.key);
                      const locked = isLocked(p.id, cat.key);
                      return (
                        <td key={p.id} className="p-3">
                          <div className="flex items-center gap-1.5">
                            {locked && <Lock size={11} className="text-amber shrink-0" />}
                            <span className={correct === true ? 'font-semibold text-sage' : correct === false ? 'text-ink-muted' : 'text-ink'}>
                              {getPlayerPick(p.id, cat.key)}
                            </span>
                            {correct === true && <Check size={13} className="text-sage" />}
                            {pickScore !== null && pickScore !== 0 && (
                              <span className={`text-xs font-semibold ${pickScore > 0 ? 'text-sage' : 'text-terracotta'}`}>
                                {pickScore > 0 ? '+' : ''}{pickScore}
                              </span>
                            )}
                            {correct === false && (pickScore === null || pickScore === 0) && <X size={13} className="text-ink-faint" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Week Scores */}
      {scored && Object.keys(scores).length > 0 && (
        <div className="card p-5 animate-fade-up">
          <h3 className="font-display text-lg text-ink mb-4">Week {episode.week_number} Scores</h3>
          <div className="space-y-2">
            {players
              .map((p) => ({ player: p, pts: scores[p.id] || 0 }))
              .sort((a, b) => b.pts - a.pts)
              .map(({ player, pts }, i) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    i === 0 && pts > 0 ? 'bg-amber-subtle' : 'bg-cream'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: getPlayerColor(player.color).bg, color: '#fff' }}>
                      {player.name[0]}
                    </span>
                    <span className="font-semibold text-ink">{player.name}</span>
                  </div>
                  <span className={`font-bold tabular-nums ${pts > 0 ? 'text-sage' : pts < 0 ? 'text-terracotta' : 'text-ink-muted'}`}>
                    {pts > 0 ? '+' : ''}{pts}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {!scored && episode.status === 'locked' && picks.length > 0 && (
        <div className="card p-5 text-center">
          <p className="text-ink-muted text-sm">Picks are locked. Results will be entered after the episode.</p>
        </div>
      )}

      {!scored && episode.status === 'locked' && picks.length === 0 && (
        <div className="card p-5 text-center">
          <p className="text-ink-muted text-sm">This episode is locked. No picks were submitted.</p>
        </div>
      )}

      {episode.status === 'open' && (
        <Link href="/picks" className="btn btn-primary btn-lg w-full">
          <Target size={18} />
          Make Your Picks
        </Link>
      )}
    </div>
  );
}
