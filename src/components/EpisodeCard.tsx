'use client';

import Link from 'next/link';
import { Episode, EpisodeStatus } from '@/lib/types';
import { isDeadlinePassed } from '@/lib/deadline';
import { useNow } from '@/lib/useNow';
import DeadlineNotice from '@/components/DeadlineNotice';
import { ChevronRight, Radio, Lock, CheckCircle2, Clock } from 'lucide-react';

const STATUS_CONFIG: Record<EpisodeStatus, { label: string; className: string; icon: typeof Clock }> = {
  upcoming: { label: 'Upcoming', className: 'bg-cream-dark text-ink-muted', icon: Clock },
  open: { label: 'Open', className: 'bg-sage-subtle text-sage', icon: Radio },
  locked: { label: 'Locked', className: 'bg-terracotta-subtle text-terracotta', icon: Lock },
  scored: { label: 'Scored', className: 'bg-amber-subtle text-amber-dark', icon: CheckCircle2 },
};

interface EpisodeCardProps {
  episode: Episode;
  variant?: 'list' | 'hero';
}

export default function EpisodeCard({ episode, variant = 'list' }: EpisodeCardProps) {
  const now = useNow();
  // An 'open' episode whose deadline has gone is locked as far as anyone here is concerned,
  // even if the commissioner hasn't flipped the row yet.
  const effectiveStatus: EpisodeStatus = isDeadlinePassed(episode, now) ? 'locked' : episode.status;
  const config = STATUS_CONFIG[effectiveStatus];
  const Icon = config.icon;
  const showDeadline = episode.status === 'open';

  if (variant === 'hero') {
    return (
      <div className="flex items-baseline gap-3">
        <span className="eyebrow shrink-0">Week {episode.week_number}</span>
        <span className={`badge ${config.className}`}>
          <Icon size={10} className={effectiveStatus === 'open' ? 'animate-pulse-soft' : ''} />
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <Link href={`/episodes/${episode.week_number}`}>
      <div className="card card-interactive p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-cream-dark flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-ink-secondary">{episode.week_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink truncate">{episode.theme}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`badge ${config.className}`}>
              <Icon size={10} />
              {config.label}
            </span>
            {showDeadline && <DeadlineNotice episode={episode} variant="compact" />}
          </div>
        </div>
        <ChevronRight size={18} className="text-ink-faint shrink-0" />
      </div>
    </Link>
  );
}
