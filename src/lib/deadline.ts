import { Episode } from './types';

/**
 * Everything about the picks deadline lives here so the rules can't drift between
 * /picks, the home hero, the episode cards and the admin screen.
 *
 * `episodes.lock_at` arrives with the season-17 migration. A `select('*')` against a
 * database where that migration hasn't run yet simply omits the column, so every
 * helper below treats `undefined` exactly like `null` (= no deadline set).
 */
export type DeadlineEpisode = Pick<Episode, 'status'> & { lock_at?: string | null };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Epoch ms of the deadline, or null when none is set (or the column is missing). */
export function getLockAtMs(episode: DeadlineEpisode | null | undefined): number | null {
  return toDate(episode?.lock_at)?.getTime() ?? null;
}

/** Milliseconds until the deadline (negative once it's gone), or null when none is set. */
export function msUntilDeadline(episode: DeadlineEpisode | null | undefined, now: number): number | null {
  const lockAt = getLockAtMs(episode);
  return lockAt === null ? null : lockAt - now;
}

/**
 * Can a player still submit?
 *
 * `now` is `null` before the client has hydrated — we can't compare against the
 * viewer's clock yet, so fall back to the stored status alone.
 */
export function isPicksOpen(
  episode: DeadlineEpisode | null | undefined,
  now: number | null = Date.now()
): boolean {
  if (!episode || episode.status !== 'open') return false;
  if (now === null) return true;
  const lockAt = getLockAtMs(episode);
  return lockAt === null || now < lockAt;
}

/**
 * An episode the commissioner still has marked 'open' whose deadline has passed —
 * effectively locked, even though the row hasn't been updated yet.
 */
export function isDeadlinePassed(
  episode: DeadlineEpisode | null | undefined,
  now: number | null
): boolean {
  if (!episode || episode.status !== 'open' || now === null) return false;
  const lockAt = getLockAtMs(episode);
  return lockAt !== null && now >= lockAt;
}

/** "Sunday, 7:30 PM" — or "Sun, Oct 12, 7:30 PM" once it's more than a week out. */
export function formatDeadline(
  value: string | number | Date | null | undefined,
  now: number = Date.now()
): string {
  const date = toDate(value);
  if (!date) return '';
  if (Math.abs(date.getTime() - now) < 6 * DAY) {
    // Composed by hand: toLocaleString runs weekday and time together ("Sunday 7:30 PM").
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${weekday}, ${time}`;
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Sun, Oct 12, 7:30 PM" — always dated, for admin rows listing the whole season. */
export function formatDeadlineWithDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "2d 4h" · "4h 12m" · "12m" · "3m 20s" · "45s" */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'now';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  // Count seconds down in the final few minutes, where they actually matter.
  if (minutes > 0) return minutes < 5 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

/** An ISO timestamp as the local wall-clock string a <input type="datetime-local"> wants. */
export function toDatetimeLocalValue(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/**
 * The reverse: a datetime-local value carries no zone, so the browser reads it as the
 * admin's local time — exactly what we want before converting to UTC for storage.
 * Returns null for blank *and* for unparseable input; use `isDatetimeLocalValid` to tell them apart.
 */
export function datetimeLocalToISO(value: string): string | null {
  const date = toDate(value.trim() || null);
  return date ? date.toISOString() : null;
}

/** Blank is fine (= no deadline). Anything else has to parse. */
export function isDatetimeLocalValid(value: string): boolean {
  return value.trim() === '' || datetimeLocalToISO(value) !== null;
}
