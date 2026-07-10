import { catchError, from, map, switchMap, throwError, timeout, type Observable } from 'rxjs';

/**
 * CORS proxy chain — the modern stand-in for the long-dead Google Feed API.
 * Proxies are tried in order per request; the first success wins. Public
 * proxies are unreliable (corsproxy.io 403s non-localhost origins on its
 * free tier, allorigins has outages), so a self-hosted Cloudflare Worker
 * (see proxy/) belongs at the front of this list once deployed.
 */
export const CORS_PROXIES: readonly string[] = [
  'https://yarr-feed-proxy.netxpert.workers.dev/?url=',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
];

const FETCH_TIMEOUT_MS = 15_000;

function fetchVia(proxy: string, url: string): Observable<string> {
  return from(fetch(proxy + encodeURIComponent(url))).pipe(
    switchMap((res) =>
      res.ok
        ? from(res.text())
        : throwError(() => new Error(`HTTP ${res.status} while fetching ${url}`)),
    ),
    map((xml) => xml.trim()),
    timeout(FETCH_TIMEOUT_MS),
  );
}

export function fetchFeedXml(url: string): Observable<string> {
  return CORS_PROXIES.map((proxy) => () => fetchVia(proxy, url)).reduce<Observable<string>>(
    (chain, next) => chain.pipe(catchError(() => next())),
    throwError(() => new Error('No CORS proxy configured')),
  );
}
