import { useEffect, useState } from 'react';

/* The public numbers on the site — how many people, how many cards, how much raised.
 *
 * These are read straight from Postgres through two SECURITY DEFINER functions, so no SDK is
 * needed for them: the anon key can call an RPC over plain HTTP and gets back aggregates
 * only. There is no client-side arithmetic here and no cached guess. If the backend is not
 * configured, every hook returns null and the components that use them render nothing —
 * an empty space is honest, an invented "12,000+" is not.
 */

const URL_BASE = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export const isBackendLive = Boolean(URL_BASE && ANON_KEY);

async function rpc(name, body = {}, signal) {
  const response = await fetch(`${URL_BASE}/rest/v1/rpc/${name}`, {
    method: 'POST',
    signal,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${name} returned ${response.status}`);
  return response.json();
}

export const fetchSiteStats = (signal) => rpc('site_stats', {}, signal);
export const fetchTopDonors = (limit = 5, signal) => rpc('top_donors', { limit_count: limit }, signal);

/* Shared shape for both hooks: `null` until it is known, and `null` forever if the request
   fails, so a flaky network shows nothing rather than a wrong number. */
function useRemote(load, deps = []) {
  const [value, setValue] = useState(null);
  useEffect(() => {
    if (!isBackendLive) return undefined;
    const controller = new AbortController();
    load(controller.signal)
      .then(setValue)
      .catch((problem) => { if (problem.name !== 'AbortError') console.warn('Cardplume stats:', problem.message); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export const useSiteStats = () => useRemote((signal) => fetchSiteStats(signal));
export const useTopDonors = (limit = 5) => useRemote((signal) => fetchTopDonors(limit, signal), [limit]);
