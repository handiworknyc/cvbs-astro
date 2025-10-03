import type { APIRoute } from 'astro';

const ALLOW_HOSTS = (import.meta.env.WP_IMAGE_ALLOW_HOSTS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// Set STRICT_IMAGE_ALLOWLIST=0 to temporarily disable host checks (for testing)
const STRICT = (import.meta.env.STRICT_IMAGE_ALLOWLIST ?? '1') !== '0';

function authHeaders(): Record<string, string> {
  const pair = import.meta.env.WP_AUTH_BASIC as string | undefined; // "user:pass"
  if (!pair) return {};
  const token = Buffer.from(pair).toString('base64');
  return { Authorization: `Basic ${token}` };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const inUrl = new URL(request.url);
    const raw = inUrl.searchParams.get('u');
    if (!raw) return new Response('Missing ?u', { status: 400 });

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return new Response('Bad URL', { status: 400 });
    }

    const host = target.hostname.toLowerCase();

    if (STRICT && ALLOW_HOSTS.length && !ALLOW_HOSTS.includes(host)) {
      return new Response(`Forbidden host: ${host}`, { status: 403 });
    }

    // Try to look like a browser request coming from WP itself
    const wpBase = import.meta.env.WP_BASE_URL || '';
    const fetchHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (compatible; ImageProxy/1.0; +https://your-site.example)',
      Accept: '*/*',
      // These 2 often bypass basic hotlink checks:
      ...(wpBase ? { Referer: wpBase, Origin: wpBase } : {}),
      ...authHeaders(),
    };

    const upstream = await fetch(target.toString(), { headers: fetchHeaders });

    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text().catch(() => '');
      // Return body snippet so you can see why it failed in DevTools
      return new Response(
        `Upstream ${upstream.status} from ${target.toString()}\n` +
          body.slice(0, 300),
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/octet-stream'
    );
    headers.set('Cache-Control', 'public, max-age=300');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(upstream.body, { status: 200, headers });
  } catch (err: any) {
    return new Response(`Proxy error: ${err?.message || String(err)}`, {
      status: 500,
    });
  }
};
