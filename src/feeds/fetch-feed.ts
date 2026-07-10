import { from, map, switchMap, throwError, timeout, type Observable } from 'rxjs';

/**
 * Public CORS proxy — the modern stand-in for the long-dead Google Feed API.
 * Exported const so it is a one-line swap (alternative:
 * 'https://api.allorigins.win/raw?url=', which was down when this was built).
 */
export const CORS_PROXY = 'https://corsproxy.io/?url=';

const FETCH_TIMEOUT_MS = 15_000;

export function fetchFeedXml(url: string): Observable<string> {
  return from(fetch(CORS_PROXY + encodeURIComponent(url))).pipe(
    switchMap((res) =>
      res.ok
        ? from(res.text())
        : throwError(() => new Error(`HTTP ${res.status} while fetching ${url}`)),
    ),
    map((xml) => xml.trim()),
    timeout(FETCH_TIMEOUT_MS),
  );
}
