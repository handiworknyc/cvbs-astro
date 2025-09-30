import type { APIRoute } from "astro";

const WP_BASE = import.meta.env.WP_BASE_URL?.replace(/\/+$/, "");

type WPPost = {
  id: number;
  date?: string;
  date_gmt?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  _embedded?: any;
};

function htmlToText(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapPost(p: WPPost) {
  const title = p.title?.rendered ?? "";
  const dateISO = p.date ?? p.date_gmt ?? "";
  const date = dateISO
    ? new Date(dateISO).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  let imageSrc = "";
  let imageAlt = title;
  const media = p._embedded?.["wp:featuredmedia"]?.[0];
  if (media) {
    imageSrc =
      media.media_details?.sizes?.intch_med?.source_url ||
      media.media_details?.sizes?.medium_large?.source_url ||
      media.source_url ||
      "";
    imageAlt = media.alt_text || imageAlt;
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

export const GET: APIRoute = async ({ url }) => {
  if (!WP_BASE) {
    return new Response(JSON.stringify({ error: "Missing WP_BASE env var" }), { status: 500 });
  }

  // defaults like PHP
  const perPage = Number(url.searchParams.get("perPage") ?? 6);
  const order = (url.searchParams.get("order") ?? "desc").toLowerCase();
  const orderby = url.searchParams.get("orderby") ?? "date";

  // collect any taxonomy params (e.g. ?service=8&service=12&service-area=3)
  const passthrough: string[] = [];
  url.searchParams.forEach((val, key) => {
    if (!["perPage", "order", "orderby"].includes(key)) {
      passthrough.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  });

  const qs = [
    `per_page=${perPage}`,
    `order=${order}`,
    `orderby=${encodeURIComponent(orderby)}`,
    `_embed=1`,
    ...passthrough,
  ].join("&");

  const endpoint = `${WP_BASE}/wp-json/wp/v2/posts?${qs}`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: await res.text() || res.statusText }), { status: 500 });
  }
  const posts: WPPost[] = await res.json();
  return new Response(JSON.stringify({ latestPosts: posts.map(mapPost) }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
