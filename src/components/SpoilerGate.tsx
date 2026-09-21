'use client';

import { EyeOff } from 'lucide-react';

interface SpoilerGateProps {
  weeks: number[];
  onReveal: () => void;
  /** Smaller, inline version for use above standings */
  compact?: boolean;
  /** Overrides the default explanation in the full-size card */
  message?: string;
}

function weekList(weeks: number[]) {
  if (weeks.length === 1) return `Week ${weeks[0]}`;
  return `Weeks ${weeks.slice(0, -1).join(', ')} & ${weeks[weeks.length - 1]}`;
}

// Stands in for results the viewer hasn't said they've watched yet.
export default function SpoilerGate({ weeks, onReveal, compact = false, message }: SpoilerGateProps) {
  if (weeks.length === 0) return null;
  const label = weekList(weeks);
  const are = weeks.length === 1 ? 'is' : 'are';

  if (compact) {
    return (
      <div className="rounded-xl bg-amber-subtle border border-amber/20 p-3.5 flex items-center gap-3">
        <EyeOff size={16} className="text-amber-dark shrink-0" aria-hidden="true" />
        <p className="text-sm text-ink flex-1 min-w-0">
          {label} {are} scored but hidden until you&apos;ve watched.
        </p>
        <button onClick={onReveal} className="btn btn-primary btn-sm shrink-0 min-h-10">
          I&apos;ve watched
        </button>
      </div>
    );
  }

  return (
    <div className="card p-8 text-center animate-fade-up">
      <div className="w-14 h-14 rounded-2xl bg-amber-subtle flex items-center justify-center mx-auto mb-4">
        <EyeOff size={24} className="text-amber-dark" aria-hidden="true" />
      </div>
      <h3 className="font-display text-xl text-ink mb-1">No spoilers</h3>
      <p className="text-sm text-ink-muted mb-5">
        {message ?? `${label} results are in. They stay hidden until you've watched.`}
      </p>
      <button onClick={onReveal} className="btn btn-primary btn-lg w-full">
        I&apos;ve watched &mdash; show me
      </button>
    </div>
  );
}
