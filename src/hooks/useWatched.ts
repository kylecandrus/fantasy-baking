'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { usePlayer } from '@/hooks/usePlayer';

// Spoiler guard. Each player marks the weeks they've watched; results, points and
// standings for a week stay hidden on this device until they do.
// Shape in localStorage: { [playerId | 'anon']: number[] }
const KEY = 'fantasy-gbbo-watched';
const EVENT = 'fantasy-gbbo-watched-change';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) || '{}';
  } catch {
    return '{}';
  }
}

function parse(raw: string | null): Record<string, number[]> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function markWeekWatched(playerId: string | null, week: number) {
  const all = parse(readRaw());
  const who = playerId || 'anon';
  if (all[who]?.includes(week)) return;
  all[who] = [...(all[who] || []), week];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable — the reveal just won't be remembered.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useWatched() {
  const { playerId, loaded: playerLoaded } = usePlayer();
  // null on the server and before hydration: everything stays hidden until we know.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const loaded = raw !== null && playerLoaded;

  const weeks = useMemo(() => new Set(parse(raw)[playerId || 'anon'] || []), [raw, playerId]);

  const isWatched = useCallback((week: number) => loaded && weeks.has(week), [loaded, weeks]);
  const markWatched = useCallback((week: number) => markWeekWatched(playerId, week), [playerId]);

  return { loaded, isWatched, markWatched };
}

/**
 * Scores this viewer is allowed to see: only weeks they've watched. Winner-guess
 * payouts are written against early weeks but decided at the final, so they stay
 * hidden until every scored week has been watched.
 */
export function visibleScores<S extends { episode_id: string; category: string }>(
  scores: S[],
  scoredEpisodes: { id: string; week_number: number }[],
  isWatched: (week: number) => boolean
): S[] {
  const watchedIds = new Set(scoredEpisodes.filter((e) => isWatched(e.week_number)).map((e) => e.id));
  const allWatched = scoredEpisodes.every((e) => isWatched(e.week_number));
  return scores.filter((s) => watchedIds.has(s.episode_id) && (s.category !== 'winner_guess' || allWatched));
}
