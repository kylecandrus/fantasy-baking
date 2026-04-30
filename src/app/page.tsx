'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode, Player, CATEGORIES } from '@/lib/types';
import { usePlayer } from '@/hooks/usePlayer';
import Leaderboard from '@/components/Leaderboard';
import EpisodeCard from '@/components/EpisodeCard';
import Onboarding from '@/components/Onboarding';
import { Target, Tv, ArrowRight, ChevronDown } from 'lucide-react';

interface Subhead {
  text: string;
  tone?: 'default' | 'live';
}

export default function Home() {
  const { playerId } = usePlayer();
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [subhead, setSubhead] = useState<Subhead>({ text: 'A family game for The Great British Baking Show' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: episodes } = await supabase
        .from('episodes')
        .select('*')
        .order('week_number', { ascending: true });

      const open = episodes?.find((e) => e.status === 'open') || null;
      const locked = episodes?.find((e) => e.status === 'locked') || null;
      const upcoming = episodes?.find((e) => e.status === 'upcoming') || null;
      const fallback = episodes && episodes.length > 0 ? episodes[episodes.length - 1] : null;
      const featured = open || locked || upcoming || fallback;
      setCurrentEpisode(featured);

      // Build a stateful subhead.
      if (featured?.status === 'open' && playerId) {
        const totalCats = (featured.winner_guess_points ? 1 : 0) + CATEGORIES.length;
        const { data: picks } = await supabase
          .from('picks')
          .select('id')
          .eq('player_id', playerId)
          .eq('episode_id', featured.id);
        const filled = picks?.length || 0;
        setSubhead({
          tone: 'live',
          text: filled === 0
            ? `Picks are open for week ${featured.week_number} — make yours.`
            : filled < totalCats
              ? `You've made ${filled} of ${totalCats} picks for week ${featured.week_number}.`
              : `All ${totalCats} picks in for week ${featured.week_number}. Update anytime before lock.`,
        });
      } else if (featured?.status === 'open') {
        setSubhead({ tone: 'live', text: `Picks are open for week ${featured.week_number}.` });
      } else if (featured?.status === 'locked') {
        setSubhead({ text: `Week ${featured.week_number} is locked. Tune in for the results.` });
      } else if (featured?.status === 'scored') {
        // Show top of leaderboard if available.
        const [{ data: players }, { data: scores }] = await Promise.all([
          supabase.from('players').select('*'),
          supabase.from('scores').select('*'),
        ]);
        if (players && players.length > 0) {
          const totals: Record<string, number> = {};
          players.forEach((p: Player) => (totals[p.id] = 0));
          scores?.forEach((s) => (totals[s.player_id] = (totals[s.player_id] || 0) + s.points));
          const sorted = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
          const leader = sorted[0];
          const second = sorted[1];
          if (leader && totals[leader.id] > 0) {
            const lead = totals[leader.id] - (second ? totals[second.id] : 0);
            setSubhead({
              tone: 'live',
              text: lead === 0
                ? `${leader.name} and ${second.name} are tied at ${totals[leader.id]} points.`
                : `${leader.name} leads by ${lead} point${lead === 1 ? '' : 's'}.`,
            });
          }
        }
      } else if (featured?.status === 'upcoming') {
        setSubhead({ text: `Week ${featured.week_number} is up next.` });
      }

      setLoading(false);
    }
    load();
  }, [playerId]);

  return (
    <div className="space-y-8 stagger">
      <Onboarding />

      {/* Hero header */}
      <header className="pt-2 md:pt-4 max-w-2xl">
        <h1 className="font-display text-[2.25rem] md:text-[2.75rem] leading-[1.05] tracking-[-0.02em] text-ink">
          Fantasy Bake Off
        </h1>
        <p className={`mt-2 text-[15px] ${subhead.tone === 'live' ? 'text-ink' : 'text-ink-secondary'}`}>
          {subhead.tone === 'live' && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber mr-2 align-middle animate-pulse-soft" />
          )}
          {subhead.text}
        </p>
      </header>

      {/* Hero card — current episode + primary CTA */}
      {loading ? (
        <div className="card-hero p-6 md:p-8">
          <div className="skeleton h-4 w-32 mb-4" />
          <div className="skeleton h-8 w-3/4 mb-3" />
          <div className="skeleton h-12 w-full" />
        </div>
      ) : currentEpisode ? (
        <section className="card-hero p-6 md:p-8 relative">
          <EpisodeCard episode={currentEpisode} variant="hero" />
          <h2 className="font-display text-2xl md:text-3xl text-ink mt-3 leading-tight">
            {currentEpisode.theme}
          </h2>
          {currentEpisode.status === 'open' && (
            <Link
              href="/picks"
              className="btn btn-primary btn-lg w-full mt-6 group relative z-10"
            >
              <Target size={18} />
              Make Your Picks
              <ArrowRight size={16} className="ml-auto opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
          {currentEpisode.status === 'locked' && (
            <Link
              href={`/episodes/${currentEpisode.week_number}`}
              className="btn btn-secondary w-full mt-6 relative z-10"
            >
              See your picks
              <ArrowRight size={16} className="ml-auto opacity-60" />
            </Link>
          )}
          {currentEpisode.status === 'scored' && (
            <Link
              href="/leaderboard"
              className="btn btn-secondary w-full mt-6 relative z-10"
            >
              View standings
              <ArrowRight size={16} className="ml-auto opacity-60" />
            </Link>
          )}
        </section>
      ) : (
        <section className="card-hero p-8 md:p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-cream-dark flex items-center justify-center mx-auto mb-4">
            <Tv size={24} className="text-ink-muted" />
          </div>
          <h2 className="font-display text-2xl text-ink mb-1.5">The kitchen&apos;s not open yet</h2>
          <p className="text-ink-secondary mb-5 max-w-sm mx-auto">
            Add episode 1 in Admin and the season can begin.
          </p>
          <Link href="/admin" className="btn btn-secondary btn-sm">
            Go to Admin
            <ArrowRight size={14} />
          </Link>
        </section>
      )}

      {/* Leaderboard */}
      <Leaderboard />

      {/* How Scoring Works — recedes */}
      <details className="group rounded-[12px] bg-cream-dark/60 hover:bg-cream-dark transition-colors">
        <summary className="px-5 py-3.5 cursor-pointer list-none flex items-center justify-between">
          <span className="font-display text-base text-ink">How scoring works</span>
          <ChevronDown
            size={16}
            className="text-ink-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="px-5 pb-5 pt-1">
          <p className="text-sm text-ink-secondary mb-3">
            Each week, pick a contestant for every category. Correct picks earn points:
          </p>
          <div className="space-y-1">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-cream/70">
                <span className="text-ink font-medium">{cat.label}</span>
                <span className="text-ink-secondary font-semibold tabular-nums">{cat.points} pts</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-cream/70">
              <span className="text-ink font-medium">Winner Guess</span>
              <span className="text-ink-secondary font-semibold tabular-nums">7–10 pts</span>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-ink-muted leading-relaxed">
            <p>
              <span className="font-semibold text-ink-secondary">Lock:</span> You can lock ONE pick per week for 2× points if correct, but lose half if wrong.
            </p>
            <p>
              <span className="font-semibold text-ink-secondary">Penalty:</span> If you pick someone for Star Baker and they go home (or vice versa), you lose 1 point.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
