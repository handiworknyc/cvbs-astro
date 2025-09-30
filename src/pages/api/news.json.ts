// /src/pages/api/news.json.ts
import type { APIRoute } from 'astro';

const WP_BASE = import.meta.env.WP_BASE_URL!;
const DEFAULT_COUNT = 5;

// Optional: simple in-memory dedupe (per cold start) with TTL
const memo = new Map<string, { t: number; data: any }>();
const TTL_MS = 60_000; // 1 minute

export const GET: APIRoute = async ({ url }) => {
  const count = Number(url.searchParams.get('count') ?? DEFAULT_COUNT);
  const key = `news:${count}`;

  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.t < TTL_MS) {
    return new Response(JSON.stringify(hit.data), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // CDN cache: 5 minutes fresh, serve stale for a day while revalidating
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  }

  try {
    const wp = new URL(`/wp-json/wp/v2/news`, WP_BASE);
    wp.searchParams.set('per_page', String(count));
    wp.searchParams.set('orderby', 'date');
    wp.searchParams.set('order', 'desc');
    wp.searchParams.set('status', 'publish');
    wp.searchParams.set('_embed', '1');

    const res = await fetch(wp.toString(), {
      // allow CDN caching; platform will cache based on our response headers
      // and WP’s own headers; we can also pass through ETags below if desired
      // cache: 'force-cache' // optional; mostly controlled by response headers/CDN
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ posts: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, s-maxage=60, stale-while-revalidate=600',
        },
      });
    }

    const posts = await res.json();
    const payload = { posts };

    memo.set(key, { t: now, data: payload });

    return new Response(JSON.stringify(payload), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ posts: [] }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=600',
      },
    });
  }
};
