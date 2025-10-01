// /src/pages/api/news.json.ts
import type { APIRoute } from "astro";

const DEFAULT_COUNT = 5;
const MAX_COUNT = 20;

// Simple in-memory cache per cold start
const memo = new Map<string, { t: number; data: any }>();
const TTL_MS = 60_000; // 1 minute

function getWpBase(): string | null {
  // Prefer WP_BASE_URL; fall back to WORDPRESS_API_URL with /graphql stripped
  const gql = (import.meta.env.WORDPRESS_API_URL || "").trim();
  const fromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const base = (import.meta.env.WP_BASE_URL || "").trim() || fromGql;
  return base || null;
}

function authHeaders(): Record<string, string> {
  const pair = (process.env.WP_AUTH_BASIC || "").trim(); // "user:pass"
  if (!pair) return {};
  const token = Buffer.from(pair, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

export const GET: APIRoute = async ({ url }) => {
  const base = getWpBase();
  const countRaw = Number(url.searchParams.get("count") ?? DEFAULT_COUNT);
  const count = Math.min(Math.max(countRaw || DEFAULT_COUNT, 1), MAX_COUNT);
  const key = `news:${count}:${base || "no-base"}`;

  // Serve memoized (per cold start)
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.t < TTL_MS) {
    return new Response(JSON.stringify(hit.data), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  }

  // If no base configured, return empty payload (don’t error)
  if (!base) {
    const payload = { posts: [] };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  }

  try {
    // NOTE: CPT is "news"; if you use standard posts, change to /wp-json/wp/v2/posts
    const wp = new URL("/wp-json/wp/v2/news", base);
    wp.searchParams.set("_embed", "1");
    wp.searchParams.set("per_page", String(count));
    wp.searchParams.set("status", "publish");
    wp.searchParams.set("orderby", "date");
    wp.searchParams.set("order", "desc");

    const res = await fetch(wp.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "NetlifySSR/1.0 (+https://netlify.app)",
        ...authHeaders(), // <-- Basic Auth for WP Engine staging
      },
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      console.warn("[api/news] HTTP", res.status, wp.toString(), text.slice(0, 200));
      const payload = { posts: [] };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
        },
      });
    }

    // Tolerate mislabelled content-type / HTML challenges
    let posts: any[] = [];
    try {
      const json = JSON.parse(text);
      posts = Array.isArray(json) ? json : [];
    } catch {
      if (/^\s*</.test(text)) {
        console.warn("[api/news] HTML body from WP (auth/challenge?)");
      } else {
        console.warn("[api/news] Non-JSON body from WP");
      }
      posts = [];
    }

    const payload = { posts };
    memo.set(key, { t: now, data: payload });

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    console.warn("[api/news] fetch error:", e?.message || e);
    return new Response(JSON.stringify({ posts: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  }
};
