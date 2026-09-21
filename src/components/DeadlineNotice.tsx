'use client';

import { Clock, Lock } from 'lucide-react';
import { Episode } from '@/lib/types';
import { formatDeadline, formatTimeRemaining, msUntilDeadline } from '@/lib/deadline';
import { useNow } from '@/lib/useNow';

interface DeadlineNoticeProps {
  episode: Episode;
  /** `banner` for the picks page and home hero, `compact` for list rows. */
  variant?: 'banner' | 'compact';
}

/**
 * The one place the deadline gets spoken out loud. Ticks live, and flips to the closed
 * wording the moment the deadline passes — no reload.
 */
export default function DeadlineNotice({ episode, variant = 'banner' }: DeadlineNoticeProps) {
  const now = useNow();

  // Deadlines are rendered in the viewer's timezone, so nothing here can be
  // server-rendered without a hydration mismatch.
  if (now === null) return null;

  const remaining = msUntilDeadline(episode, now);
  const passed = remaining !== null && remaining <= 0;

  let icon = <Clock size={14} className="shrink-0 text-amber-dark" />;
  let body: React.ReactNode;

  if (remaining === null) {
    body = <>Picks close when the commissioner locks them.</>;
  } else if (passed) {
    icon = <Lock size={14} className="shrink-0 text-terracotta" />;
    body = (
      <>
        Picks closed <strong className="text-ink">{formatDeadline(episode.lock_at, now)}</strong>.
      </>
    );
  } else {
    body = (
      <>
        Picks close <strong className="text-ink">{formatDeadline(episode.lock_at, now)}</strong>
        <span className="text-ink-muted tabular-nums"> (in {formatTimeRemaining(remaining)})</span>
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-secondary">
        {icon}
        <span>{body}</span>
      </span>
    );
  }

  return (
    <div
      className={`rounded-[12px] px-4 py-3 text-sm leading-relaxed flex items-center gap-2.5 ${
        passed ? 'bg-terracotta-subtle text-terracotta' : 'bg-cream-dark/70 text-ink-secondary'
      }`}
      aria-live="polite"
    >
      {icon}
      <span>{body}</span>
    </div>
  );
}
