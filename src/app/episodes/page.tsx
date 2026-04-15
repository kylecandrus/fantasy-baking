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

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl text-ink">Episodes</h1>
      {episodes.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-4">
            <Tv size={24} className="text-ink-muted" />
          </div>
          <p className="text-ink-muted">No episodes created yet.</p>
        </div>
      ) : (
        <div className="space-y-2 stagger">
          {episodes.map((ep) => (
            <EpisodeCard key={ep.id} episode={ep} />
          ))}
        </div>
      )}
    </div>
  );
}
