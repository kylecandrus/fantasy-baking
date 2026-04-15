'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode, CATEGORIES } from '@/lib/types';
import Leaderboard from '@/components/Leaderboard';
import EpisodeCard from '@/components/EpisodeCard';
import { Target, Tv, BarChart3, ArrowRight, Radio, ChevronDown } from 'lucide-react';

export default function Home() {
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: episodes } = await supabase
        .from('episodes')
        .select('*')
        .order('week_number', { ascending: true });

      if (episodes && episodes.length > 0) {
        const open = episodes.find((e) => e.status === 'open');
        const locked = episodes.find((e) => e.status === 'locked');
        const upcoming = episodes.find((e) => e.status === 'upcoming');
        setCurrentEpisode(open || locked || upcoming || episodes[episodes.length - 1]);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6 stagger">
      {/* Header */}
      <div className="pt-4 md:pt-2">
        <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
          Fantasy Bake Off
        </h1>
        <p className="text-ink-muted mt-1">May the best picker win</p>
      </div>

      {/* Current Episode */}
      {loading ? (
        <div className="card p-6">
          <div className="skeleton h-5 w-24 mb-3" />
          <div className="skeleton h-14 w-full" />
        </div>
      ) : currentEpisode ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">This Week</h2>
            {currentEpisode.status === 'open' && (
              <span className="badge bg-sage-subtle text-sage">
                <Radio size={9} className="animate-pulse-soft" />
                Picks Open
              </span>
            )}
          </div>
          <EpisodeCard episode={currentEpisode} />
          {currentEpisode.status === 'open' && (
            <Link
              href="/picks"
              className="btn btn-primary btn-lg w-full mt-4 group"
            >
              <Target size={18} />
              Make Your Picks
              <ArrowRight size={16} className="ml-auto opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-4">
            <Tv size={24} className="text-ink-muted" />
          </div>
          <h3 className="font-display text-xl text-ink mb-1">No episodes yet</h3>
          <p className="text-sm text-ink-muted mb-4">
            The season hasn&apos;t started. Set up episodes in Admin.
          </p>
          <Link href="/admin" className="btn btn-secondary btn-sm">
            Go to Admin
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Leaderboard */}
      <Leaderboard />

      {/* How Scoring Works */}
      <details className="card overflow-hidden">
        <summary className="px-5 py-4 font-display text-lg text-ink cursor-pointer hover:bg-cream-dark transition-colors list-none flex items-center justify-between">
          How Scoring Works
          <ChevronDown size={16} className="text-ink-muted transition-transform [[open]>&]:rotate-180" />
        </summary>
        <div className="px-5 pb-5 border-t border-border/50">
          <p className="text-sm text-ink-secondary mt-4 mb-3">Each week, pick a contestant for every category. Correct picks earn points:</p>
          <div className="space-y-1.5">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-cream">
                <span className="text-ink font-medium">{cat.label}</span>
                <span className="text-ink-muted font-semibold tabular-nums">{cat.points} pts</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-cream">
              <span className="text-ink font-medium">Winner Guess</span>
              <span className="text-ink-muted font-semibold tabular-nums">7–10 pts</span>
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3">
            Penalty: If you pick someone for Star Baker, Technical Winner, or Handshake and they get sent home that week, you lose 1 point.
          </p>
        </div>
      </details>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/episodes" className="card card-interactive p-4 flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-cream-dark flex items-center justify-center">
            <Tv size={18} className="text-ink-secondary" />
          </div>
          <span className="font-medium text-ink text-sm">All Episodes</span>
        </Link>
        <Link href="/leaderboard" className="card card-interactive p-4 flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-cream-dark flex items-center justify-center">
            <BarChart3 size={18} className="text-ink-secondary" />
          </div>
          <span className="font-medium text-ink text-sm">Full Standings</span>
        </Link>
      </div>
    </div>
  );
}
