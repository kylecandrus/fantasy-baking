'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Episode } from '@/lib/types';
import EpisodeCard from '@/components/EpisodeCard';
import { Tv } from 'lucide-react';

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('episodes')
      .select('*')
      .order('week_number', { ascending: true })
      .then(({ data }) => {
        if (data) setEpisodes(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-32" />
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}
      </div>
    );
  }

  const scoredCount = episodes.filter((e) => e.status === 'scored').length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-[2.25rem] text-ink leading-tight">Episodes</h1>
        <p className="text-ink-secondary mt-1 text-sm">
          {episodes.length === 0
            ? 'Nothing on the schedule yet.'
            : `${episodes.length} ${episodes.length === 1 ? 'episode' : 'episodes'} · ${scoredCount} scored`}
        </p>
      </header>
      {episodes.length === 0 ? (
        <div className="rounded-[16px] bg-cream-dark/60 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center mx-auto mb-4">
            <Tv size={20} className="text-ink-muted" />
          </div>
          <p className="text-ink-secondary">The kitchen&apos;s not open yet — add your first episode in Admin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
          {episodes.map((ep) => (
            <EpisodeCard key={ep.id} episode={ep} />
          ))}
        </div>
      )}
    </div>
  );
}
