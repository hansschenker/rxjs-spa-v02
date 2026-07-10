/**
 * yarr-feed-proxy — minimal CORS proxy for the rxjs-spa RSS reader.
 *
 * GET /?url=<encoded feed url> fetches the feed server-side and streams it
 * back with CORS headers. Origin-allowlisted so it is not an open proxy:
 * only the deployed app and localhost dev servers may call it.
 */

const ALLOWED_ORIGINS = new Set([
  'https://netxpert.ch',
  'http://netxpert.ch',
  'https://hansschenker.github.io',
]);

const isAllowedOrigin = (origin) =>
  origin !== null &&
  (ALLOWED_ORIGINS.has(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin));

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'https://netxpert.ch',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }
    if (!isAllowedOrigin(origin)) {
      return new Response('Origin not allowed', { status: 403, headers: corsHeaders });
    }

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url') ?? '');
    } catch {
      return new Response('Missing or invalid ?url= parameter', {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return new Response('Only http(s) targets are allowed', {
        status: 400,
        headers: corsHeaders,
      });
    }

    try {
      const upstream = await fetch(target, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'yarr-feed-proxy/1.0 (+https://github.com/hansschenker/rxjs-spa-v02)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });
      // Stream the body through — feeds can be large; never buffer them here.
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          'Content-Type': upstream.headers.get('Content-Type') ?? 'application/xml',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err instanceof Error ? err.message : err}`, {
        status: 502,
        headers: corsHeaders,
      });
    }
  },
};
