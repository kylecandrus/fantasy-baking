'use client';

import { useEffect, useState } from 'react';

/**
 * A ticking clock for live countdowns.
 *
 * Returns `null` until the component has mounted on the client: deadlines render in the
 * viewer's own timezone, so anything derived from the clock has to stay out of the
 * server-rendered markup or hydration mismatches.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Load-on-mount: the first reading can only be taken in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock, see above
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
