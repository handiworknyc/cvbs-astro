// src/lib/wp/pullFlexText.ts
// Reusable helpers to pull ACF flex text (or any field) from WP via /wp-json/cv/v1/acf-flex-text
// NOTE: Run server-side only (frontmatter/SSR). Cheerio won't work in the browser.

import * as cheerio from "cheerio";
import { getEnv, toBase64 } from "../env.ts"; // path is one dir up

export type PullFrom = {
  objectType: "post" | "term";
  objectId: number;
  taxonomy?: string;     // required for term when objectType === "term"
  field?: string;        // defaults to "flex_text"
  selector?: string;     // e.g. "#why-clearview" (server can pre-filter)
  rowIndex?: number;     // e.g. 3 -> extract element with class "rowindex-3"
};

export type FetchFlexResp = {
  html: string;          // final HTML
  raw?: any;             // raw JSON (optional debug)
  status?: number;       // HTTP status code on error
  url?: string;          // request URL
  error?: string;        // thrown error message (if thrown)
  peek?: string;         // first 200 chars of error body / response text
};

const WP_BASE = import.meta.env.WP_BASE_URL || "";

/* ---------- Auth (matches api.js behavior) ---------- */
function authHeaders(): Record<string, string> {
  const pair = getEnv("WP_AUTH_BASIC"); // "user:pass"
  if (!pair) return {};
  const token = toBase64(pair);
  return token ? { Authorization: `Basic ${token}` } : {};
}

/** Map known class names from WP output to your utilities. */
function mapKnownClassNames(token: string): string {
  if (token === "container-fluid") return "hw-contain";
  return token;
}

/** Only rename classes (no spacing conversion): container-fluid -> hw-contain */
function mapKnownClassesInHtml(html: string): string {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  $("[class]").each((_, el) => {
    const original = ($(el).attr("class") || "").split(/\s+/).filter(Boolean);
    const mapped = original.map((c) => mapKnownClassNames(c));
    const deduped = Array.from(new Set(mapped)).join(" ");
    $(el).attr("class", deduped);
  });

  return $.html();
}

/* -------------------------------------------------------
 * Image attribute fixups:
 * - data-src → src, data-srcset → srcset
 * - Always add loading="lazy" + async attribute
 * - If data-postload OR class "critical" → fetchpriority="high"
 * ------------------------------------------------------- */
function fixImagesInHtml(html: string): string {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  $("img").each((_, img) => {
    const $img = $(img);
    const dataSrc = $img.attr("data-src");
    const dataSrcset = $img.attr("data-srcset");

    if (dataSrc) $img.attr("src", dataSrc);
    if (dataSrcset) $img.attr("srcset", dataSrcset);

    $img.attr("loading", "lazy");
    $img.attr("async", "");

    const hasPostload = $img.is("[data-postload]");
    const hasCritical = ($img.attr("class") || "").split(/\s+/).includes("critical");
    if (hasPostload || hasCritical) {
      $img.attr("fetchpriority", "high");
    }
  });

  return $.html();
}

/* -------------------------------------------------------
 * Strip redundant WP wrappers to avoid duplication with Astro
 * ------------------------------------------------------- */
function stripRedundantFlexWrappers(html: string): string {
  if (!html) return html;

  let out = html;

  for (let i = 0; i < 3; i++) {
    const $ = cheerio.load(out, { decodeEntities: false });

    const $base = $(".flex-module").first();
    if (!$base.length) break;

    const $outer = $base.children(".whitebg-1, .mintbg-1").first();
    if (!$outer.length) break;

    const $inner = $outer.children(".flex-bg-inner, .pr").first();
    if (!$inner.length) break;

    const childrenHtml = $inner
      .contents()
      .toArray()
      .map((n) => $.html(n))
      .join("");

    if (!childrenHtml) break;

    out = childrenHtml;

    if (out.includes("flex-module") && out.includes("whitebg-1")) {
      continue;
    } else {
      break;
    }
  }

  return out;
}

/* ---------------- Image URL rewrite to WP REST proxy ---------------- */

function mapSrcset(srcset: string, mapUrl: (u: string) => string): string {
  return srcset
    .split(',')
    .map(part => {
      const [url, size] = part.trim().split(/\s+/, 2);
      return [mapUrl(url), size].filter(Boolean).join(' ');
    })
    .join(', ');
}

function rewriteImagesToWpRest(html: string, wpBase: string): string {
  if (!html || !wpBase) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  let wpHost = "";
  try { wpHost = new URL(wpBase).hostname; } catch {}

  const toProxy = (u: string) => {
    try {
      const abs = new URL(u, wpBase);
      // only rewrite images hosted on this WP
      if (wpHost && abs.hostname !== wpHost) return u;
      if (!/\/wp-content\/uploads\//.test(abs.pathname)) return u;
      return `${wpBase.replace(/\/+$/,'')}/wp-json/cv/v1/img?u=${encodeURIComponent(abs.toString())}`;
    } catch {
      return u;
    }
  };

  $("img").each((_, el) => {
    const $img = $(el);

    const src = $img.attr("src") || $img.attr("data-src");
    if (src) $img.attr("src", toProxy(src));

    const ss = $img.attr("srcset") || $img.attr("data-srcset");
    if (ss) $img.attr("srcset", mapSrcset(ss, toProxy));
  });

  return $.html();
}

/* ---------------- Cheerio extractors ---------------- */

export function extractBySelector(html: string, selector: string): string {
  if (!html || !selector) return "";
  try {
    const $ = cheerio.load(html, { decodeEntities: false });
    const el = $(selector).first();
    return el.length ? $.html(el) : "";
  } catch {
    return "";
  }
}

export function extractByRowIndex(html: string, n: number): string {
  if (!html || !Number.isFinite(n)) return "";
  try {
    const $ = cheerio.load(html, { decodeEntities: false });
    const el = $(`.rowindex-${n}`).first();
    return el.length ? $.html(el) : "";
  } catch {
    return "";
  }
}

/* ---------------- Public API ---------------- */

export async function fetchFlexText(pf: PullFrom): Promise<FetchFlexResp> {
  if (!WP_BASE) {
    const msg = "[pullFlexText] Missing WP_BASE_URL env";
    console.error(msg);
    return { html: "", error: msg };
  }

  const field = pf.field || "flex_text";
  const qs = new URLSearchParams({
    object_type: pf.objectType,
    object_id: String(pf.objectId),
    field,
  });
  if (pf.objectType === "term" && pf.taxonomy) qs.set("taxonomy", pf.taxonomy);
  if (pf.selector) qs.set("selector", pf.selector);

  const url = `${WP_BASE}/wp-json/cv/v1/acf-flex-text?${qs.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...authHeaders(),
      },
    });

    if (!res.ok) {
      const peek = await res.text().catch(() => "");
      console.error("[pullFlexText] HTTP", res.status, url, peek.slice(0, 200));
      return { html: "", status: res.status, url, peek: peek.slice(0, 200) };
    }

    const data = await res.json();

    let html: string = (data?.selected?.html ?? data?.html) || "";
    if (!html) {
      const msg = "[pullFlexText] Empty HTML in response";
      console.error(msg, { url, data: JSON.stringify(data)?.slice(0, 200) });
      return { html: "", raw: data, url, error: msg };
    }

    if (pf.selector && !data?.selected?.html) {
      const bySel = extractBySelector(html, pf.selector);
      if (bySel) html = bySel;
    }

    if (Number.isFinite(pf.rowIndex)) {
      const byRow = extractByRowIndex(html, pf.rowIndex as number);
      if (byRow) html = byRow;
    }

    html = stripRedundantFlexWrappers(html);
    html = mapKnownClassesInHtml(html);
    html = fixImagesInHtml(html);

    // Rewrite uploads to the WP REST proxy so static hotlink/CDN rules are bypassed
    html = rewriteImagesToWpRest(html, WP_BASE);

    return { html, raw: data, url };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[pullFlexText] fetch error", msg, { url });
    return { html: "", error: msg, url };
  }
}

/** Decode entities repeatedly (handles double-encoded text) */
export function decodeEntitiesDeep(s = ""): string {
  let out = s;
  for (let i = 0; i < 4; i++) {
    const before = out;
    out = out
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&#(\d+);/g,       (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    if (out === before) break;
  }
  return out;
}
