// src/pages/api/blog-latest.json.ts
import type { APIRoute } from "astro";

type WPPost = {
  id: number;
  date?: string;
  date_gmt?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  _embedded?: any;
};

const DEFAULT_PER_PAGE = 6;
const MAX_PER_PAGE = 20;

// --- helpers ---------------------------------------------------------------

function getWpBase(): string | null {
  // Prefer WP_BASE_URL; fall back to WORDPRESS_API_URL with /graphql stripped
  const gql = (import.meta.env.WORDPRESS_API_URL || "").trim();
  const fromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const base = (import.meta.env.WP_BASE_URL || "").trim() || fromGql;
  return base || null;
}

function authHeaders(): Record<string, string> {
  // Server-only Basic Auth for WP Engine staging
  const pair = (process.env.WP_AUTH_BASIC || "").trim(); // "user:pass"
  if (!pair) return {};
  const token = Buffer.from(pair, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

function htmlToText(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapPost(p: WPPost) {
  const title = p.title?.rendered ?? "";
  const dateISO = p.date ?? p.date_gmt ?? "";
  const date = dateISO
    ? new Date(dateISO).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  // Featured image (uses embedded sizes if present)
  let imageSrc = "";
  let imageAlt = title;
  const media = p._embedded?.["wp:featuredmedia"]?.[0];
  if (media) {
    imageSrc =
      media?.media_details?.sizes?.intch_med?.source_url ||
      media?.media_details?.sizes?.medium_large?.source_url ||
      media?.source_url ||
      "";
    imageAlt = media?.alt_text || imageAlt;
  }

  return {
    id: p.id,
    title,
    date,
    dateISO,
    excerpt: htmlToText(p.excerpt?.rendered ?? ""),
    permalink: p.link || "",
    image: imageSrc ? { src: imageSrc, alt: imageAlt } : null,
  };
}

// --- API route -------------------------------------------------------------

export const GET: APIRoute = async ({ url }) => {
  const base = getWpBase();

  // Bound perPage
  const perPageRaw = Number(url.searchParams.get("perPage") ?? DEFAULT_PER_PAGE);
  const perPage =
    Number.isFinite(perPageRaw) && perPageRaw > 0
      ? Math.min(perPageRaw, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  const order = (url.searchParams.get("order") ?? "desc").toLowerCase();
  const orderby = url.searchParams.get("orderby") ?? "date";

  // Collect passthrough taxonomy filters (?service=8&service-area=3 etc.)
  const passthrough: string[] = [];
  url.searchParams.forEach((val, key) => {
    if (!["perPage", "order", "orderby"].includes(key)) {
      passthrough.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  });

  // If env not configured, return empty payload (don’t fail SSR)
  if (!base) {
    return new Response(JSON.stringify({ latestPosts: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  }

  const qs = [
    `per_page=${perPage}`,
    `order=${order}`,
    `orderby=${encodeURIComponent(orderby)}`,
    `_embed=1`,
    ...passthrough,
  ].join("&");

  const endpoint = `${base.replace(/\/+$/, "")}/wp-json/wp/v2/posts?${qs}`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "NetlifySSR/1.0 (+https://netlify.app)",
        ...authHeaders(), // << Basic Auth for WP Engine staging
      },
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      console.warn("[api/blog-latest] HTTP", res.status, endpoint, text.slice(0, 200));
      return new Response(JSON.stringify({ latestPosts: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
        },
      });
    }

    // Tolerate HTML or mislabelled content
    let raw: WPPost[] = [];
    try {
      const json = JSON.parse(text);
      raw = Array.isArray(json) ? json : [];
    } catch {
      // HTML challenge or non-JSON → empty payload
      console.warn("[api/blog-latest] Non-JSON body from WP (auth/challenge?)");
      raw = [];
    }

    const latestPosts = raw.map(mapPost);

    return new Response(JSON.stringify({ latestPosts }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // CDN cache 5m, serve stale while revalidating for 1d
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    console.warn("[api/blog-latest] fetch error:", e?.message || e);
    return new Response(JSON.stringify({ latestPosts: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  }
};
