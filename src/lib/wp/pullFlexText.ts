// src/lib/wp/pullFlexText.ts
// Pull ACF flex text (or any field) from WP via /wp-json/cv/v1/acf-flex-text
// Server-only. Uses cheerio to optionally slice & sanitize the HTML.

import * as cheerio from "cheerio";
import { getEnv, toBase64 } from "../env.ts";

export type PullFrom = {
  objectType: "post" | "term";
  objectId?: number;         // for terms this can be omitted if you provide objectSlug
  objectSlug?: string;       // when objectType === "term", resolve id via slug if needed
  taxonomy?: string;         // required when objectType === "term"
  field?: string;            // defaults to "flex_text"
  selector?: string;         // e.g. "#why-clearview" (server can pre-filter)
  rowIndex?: number;         // e.g. 3 -> extract .rowindex-3
  /** If explicit pull and no selector, slice by module class (e.g. "logo_slider"). */
  moduleClass?: string;

  /** Turn on verbose server-side logging for this call (overrides env). */
  debug?: boolean;
};

export type FetchFlexResp = {
  html: string;
  raw?: any;
  status?: number;
  url?: string;
  error?: string;
  peek?: string;
};

const WP_BASE = import.meta.env.WP_BASE_URL || "";
const ENV_DEBUG = (process.env.PULL_FLEX_DEBUG || "").toString() === "1";

/* ---------- Auth ---------- */
function authHeaders(): Record<string, string> {
  const pair = getEnv("WP_AUTH_BASIC"); // "user:pass"
  if (!pair) return {};
  const token = toBase64(pair);
  return token ? { Authorization: `Basic ${token}` } : {};
}

/* ---------- Small debug helpers ---------- */
type HtmlSummary = {
  htmlLen: number;
  topElementCount: number;
  firstTag: string | null;
  firstClasses: string[];
  flexModuleCount: number; // number of elements with .flex-module
  topIsFlexModule: boolean;
  first200: string;
};

function summarizeHtml(html = ""): HtmlSummary {
  try {
    const $ = cheerio.load(html, { decodeEntities: false });

    const nodes = $.root().children().toArray().filter((n: any) => n.type === "tag");
    const first = nodes[0] as any | undefined;

    const firstTag = first ? first.name || null : null;
    const firstCls = first ? ((first.attribs?.class || "").split(/\s+/).filter(Boolean)) : [];
    const flexCnt = $(".flex-module").length;
    const topIsFlex = !!(firstCls.includes("flex-module"));

    return {
      htmlLen: html.length,
      topElementCount: nodes.length,
      firstTag: firstTag,
      firstClasses: firstCls,
      flexModuleCount: flexCnt,
      topIsFlexModule: topIsFlex,
      first200: html.slice(0, 200).replace(/\s+/g, " "),
    };
  } catch {
    return {
      htmlLen: html.length,
      topElementCount: 0,
      firstTag: null,
      firstClasses: [],
      flexModuleCount: 0,
      topIsFlexModule: false,
      first200: html.slice(0, 200).replace(/\s+/g, " "),
    };
  }
}

function logStep(label: string, html: string, extra?: Record<string, any>) {
  const sum = summarizeHtml(html);
  const payload = { step: label, ...sum, ...(extra || {}) };
  // Single-line, readable output:
  console.log(`[pullFlexText] ${label}:`, payload);
  return sum;
}

/* ---------- Class mapping (token-level) ---------- */
function mapKnownClassNames(token: string): string {
  if (token === "container-fluid") return "hw-contain";
  return token;
}

function mapKnownClassesInHtml(html: string): string {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: false });
  $("[class]").each((_, el) => {
    const tokens = ($(el).attr("class") || "").split(/\s+/).filter(Boolean);
    const mapped = tokens.map(mapKnownClassNames);
    const deduped = Array.from(new Set(mapped)).join(" ");
    $(el).attr("class", deduped);
  });
  return $.html();
}

/* ---------- Images: data-* → real attrs + perf hints ---------- */
function fixImagesInHtml(html: string): string {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  $("img").each((_, node) => {
    const $img = $(node);
    const dataSrc = $img.attr("data-src");
    const dataSrcset = $img.attr("data-srcset");
    const dataSizes = $img.attr("data-sizes");

    if (dataSrc) $img.attr("src", dataSrc);
    if (dataSrcset) $img.attr("srcset", dataSrcset);
    if (dataSizes) $img.attr("sizes", dataSizes);

    // desired attrs
    $img.attr("loading", "lazy");
    $img.attr("async", "");

    // promote critical or explicitly postload-marked images
    const hasPostload = $img.is("[data-postload]");
    const isCritical = ($img.attr("class") || "").split(/\s+/).includes("critical");
    if (hasPostload || isCritical) {
      $img.attr("fetchpriority", "high");
    }

    // cleanup
    $img.removeAttr("data-src");
    $img.removeAttr("data-srcset");
    $img.removeAttr("data-sizes");
  });

  return $.html();
}

function stripTopFlexModule(html: string): { html: string; stripped: boolean } {
  if (!html) return { html, stripped: false };
  const $ = cheerio.load(html, { decodeEntities: false });

  // Prefer working from <body> to avoid the cheerio <html>/<body> wrappers issue.
  const bodyChildren = $("body")
    .children()
    .toArray()
    .filter((n: any) => n.type === "tag");

  if (bodyChildren.length) {
    const $first = $(bodyChildren[0] as any);
    const classes = ($first.attr("class") || "").split(/\s+/).filter(Boolean);
    const isFlex = classes.includes("flex-module");

    if (isFlex) {
      // Unwrap the top flex-module: keep its children only
      const inner = $first.html() || "";
      return { html: inner, stripped: true };
    }
  }

  // Fallback: try old root-level logic once, in case there's no <body>
  const rootEls = $.root().children().toArray().filter((n: any) => n.type === "tag");
  if (rootEls.length === 1) {
    const $only = $(rootEls[0] as any);
    const classes = ($only.attr("class") || "").split(/\s+/).filter(Boolean);
    if (classes.includes("flex-module")) {
      const inner = $only.html() || "";
      return { html: inner, stripped: true };
    }
  }

  return { html, stripped: false };
}

/* ---------- Proxy rewrite ---------- */
function mapSrcset(srcset: string, mapUrl: (u: string) => string): string {
  return srcset
    .split(",")
    .map((part) => {
      const [url, size] = part.trim().split(/\s+/, 2);
      return [mapUrl(url), size].filter(Boolean).join(" ");
    })
    .join(", ");
}

function rewriteImagesToProxy(html: string, wpHost: string): string {
  if (!html || !wpHost) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  const mapUrl = (u: string) => {
    try {
      const abs = new URL(u, `https://${wpHost}`);
      if (abs.hostname !== wpHost) return u; // only rewrite WP-hosted images
      return `/api/img?u=${encodeURIComponent(abs.toString())}`;
    } catch {
      return u;
    }
  };

  $("img").each((_, el) => {
    const $img = $(el);
    const src = $img.attr("src") || $img.attr("data-src");
    if (src) $img.attr("src", mapUrl(src));

    const ss = $img.attr("srcset") || $img.attr("data-srcset");
    if (ss) $img.attr("srcset", mapSrcset(ss, mapUrl));
  });

  return $.html();
}

/* ---------- Slicers ---------- */
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

/** Slice first module block by module class (e.g. "logo_slider" → ".logo_slider-module") */
export function extractByModuleClass(html: string, moduleClass: string): string {
  if (!html || !moduleClass) return "";
  try {
    const $ = cheerio.load(html, { decodeEntities: false });
    let $el = $(`.${moduleClass}-module`).first();
    if (!$el.length) $el = $(`.${moduleClass}_module`).first();
    if (!$el.length) $el = $(`.${moduleClass}`).first();
    return $el.length ? $.html($el) : "";
  } catch {
    return "";
  }
}

/* ---------- Term id resolver ---------- */
async function resolveTermIdBySlug(taxonomy: string, slug: string): Promise<number | null> {
  if (!WP_BASE || !taxonomy || !slug) return null;
  const url = `${WP_BASE}/wp-json/wp/v2/${encodeURIComponent(taxonomy)}?slug=${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", ...authHeaders() } });
    if (!res.ok) {
      const peek = await res.text().catch(() => "");
      console.error("[pullFlexText] term lookup HTTP", res.status, url, peek.slice(0, 200));
      return null;
    }
    const arr = await res.json();
    const id = Array.isArray(arr) && arr[0]?.id ? Number(arr[0].id) : null;
    if (!id) console.warn("[pullFlexText] term not found for slug", { taxonomy, slug, url });
    return id;
  } catch (e: any) {
    console.error("[pullFlexText] term lookup error", e?.message || String(e), { url });
    return null;
  }
}

/* ---------- Public API ---------- */
export async function fetchFlexText(pf: PullFrom): Promise<FetchFlexResp> {
  if (!WP_BASE) {
    const msg = "[pullFlexText] Missing WP_BASE_URL env";
    console.error(msg);
    return { html: "", error: msg };
  }
  const shouldDebug = !!pf.debug || ENV_DEBUG;
  const field = pf.field || "flex_text";

  // Validate term pulls + optional slug resolve
  if (pf.objectType === "term") {
    if (!pf.taxonomy) {
      const msg = "[pullFlexText] taxonomy is required when objectType==='term'";
      console.error(msg, pf);
      return { html: "", error: msg };
    }
    if (!pf.objectId && pf.objectSlug) {
      const maybe = await resolveTermIdBySlug(pf.taxonomy, pf.objectSlug);
      if (maybe) pf.objectId = maybe;
    }
    if (!pf.objectId) {
      const msg = "[pullFlexText] objectId (term id) is required for term pulls (or provide objectSlug to resolve it)";
      console.error(msg, pf);
      return { html: "", error: msg };
    }
  }

  const qs = new URLSearchParams({
    object_type: pf.objectType,
    object_id: String(pf.objectId!),
    field,
  });
  if (pf.objectType === "term" && pf.taxonomy) qs.set("taxonomy", pf.taxonomy);
  if (pf.selector) qs.set("selector", pf.selector);

  const url = `${WP_BASE}/wp-json/cv/v1/acf-flex-text?${qs.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...authHeaders() },
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

    if (shouldDebug) logStep("RAW_FROM_WP", html, { url, pf });

    // ---- Slicing priority ----
    let usedSelector = false;
    if (pf.selector) {
      usedSelector = true;
      if (!data?.selected?.html) {
        const bySel = extractBySelector(html, pf.selector);
        if (bySel) html = bySel;
      } else {
        html = data.selected.html;
      }
      if (shouldDebug) logStep("AFTER_SELECTOR", html, { selector: pf.selector });
    }

    let usedModuleClass = false;
    if (!usedSelector && pf.moduleClass) {
      const byMod = extractByModuleClass(html, pf.moduleClass);
      if (byMod) {
        html = byMod;
        usedModuleClass = true;
      }
      if (shouldDebug) logStep("AFTER_MODULE_CLASS", html, { moduleClass: pf.moduleClass });
    }

    if (!usedSelector && !usedModuleClass && Number.isFinite(pf.rowIndex)) {
      const byRow = extractByRowIndex(html, pf.rowIndex as number);
      if (byRow) html = byRow;
      if (shouldDebug) logStep("AFTER_ROW_INDEX", html, { rowIndex: pf.rowIndex });
    }

    // ---- Sanitize / Normalize (order matters) ----
    const preStripSummary = shouldDebug ? summarizeHtml(html) : null;
    const stripped = stripTopFlexModule(html);
    html = stripped.html;
    if (shouldDebug) {
      logStep("AFTER_STRIP_TOP_FLEX", html, { strippedTopFlex: stripped.stripped, preStrip: preStripSummary });
    }

    html = mapKnownClassesInHtml(html);
    if (shouldDebug) logStep("AFTER_CLASS_MAP", html);

    html = fixImagesInHtml(html);
    if (shouldDebug) logStep("AFTER_IMG_FIX", html);

    let wpHost = "";
    try { wpHost = new URL(WP_BASE).hostname; } catch {}
    if (wpHost) {
      html = rewriteImagesToProxy(html, wpHost);
      if (shouldDebug) logStep("AFTER_PROXY_REWRITE", html, { wpHost });
    }

    // Optionally inject HTML comments so you can see steps in the DOM if needed
    if (shouldDebug && ENV_DEBUG) {
      const sum = summarizeHtml(html);
      html = `<!-- PULL_FLEX DEBUG: ${JSON.stringify({ url, step: "FINAL", sum })} -->\n${html}`;
    }

    // debug payload
    const debug = {
      url,
      objectType: pf.objectType,
      objectId: pf.objectId ?? null,
      taxonomy: pf.taxonomy ?? null,
      selector: pf.selector ?? null,
      moduleClass: pf.moduleClass ?? null,
      rowIndex: pf.rowIndex ?? null,
      usedSelector,
      usedModuleClass,
      usedRowIndex: !usedSelector && !usedModuleClass && Number.isFinite(pf.rowIndex),
      snapshots: shouldDebug
        ? {
            raw: summarizeHtml((data?.selected?.html ?? data?.html) || ""),
            final: summarizeHtml(html),
          }
        : undefined,
      htmlLen: html.length,
    };

    return { html, raw: { ...(data ?? {}), __debug: debug }, url };
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
