// src/lib/wpPull.ts
// Reusable helpers to pull ACF flex text (or any field) from WP via /wp-json/cv/v1/acf-flex-text

import * as cheerio from "cheerio";

export type PullFrom = {
  objectType: "post" | "term";
  objectId: number;
  taxonomy?: string;   // required for term when objectType === "term"
  field?: string;      // defaults to "flex_text"
  selector?: string;   // e.g. "#why-clearview" (server can pre-filter)
  rowIndex?: number;   // e.g. 3 -> extract element with class "rowindex-3"
};

export type FetchFlexResp = {
  html: string;        // final HTML (selected.html if server filtered, else post-processed)
  raw?: any;           // raw JSON (optional debug)
};

const WP_BASE = import.meta.env.WP_BASE_URL || "";

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
 * Strip redundant WP wrappers to avoid duplication with Astro:
 * We repeatedly unwrap:
 *   .flex-module > (.whitebg-1|.mintbg-1) > (.flex-bg-inner|.pr[.ofh]?)
 * and return the **children** of that inner wrapper.
 * ------------------------------------------------------- */
function stripRedundantFlexWrappers(html: string): string {
  if (!html) return html;

  let out = html;

  // Try up to 3 passes in case the snippet itself contains nested copies.
  for (let i = 0; i < 3; i++) {
    const $ = cheerio.load(out, { decodeEntities: false });

    // Find the first flex row wrapper anywhere
    const $base = $(".flex-module").first();
    if (!$base.length) break;

    // We only want to unwrap when it’s using the classic white/mint -> inner structure
    const $outer = $base.children(".whitebg-1, .mintbg-1").first();
    if (!$outer.length) break;

    const $inner = $outer.children(".flex-bg-inner, .pr").first();
    if (!$inner.length) break;

    // Grab just the inner payload (children), because Astro provides its own wrapper
    const childrenHtml = $inner
      .contents()
      .toArray()
      .map((n) => $.html(n))
      .join("");

    if (!childrenHtml) break;

    out = childrenHtml;

    // If another wrapper still exists, peel one more layer
    if (out.includes("flex-module") && out.includes("whitebg-1")) {
      continue;
    } else {
      break;
    }
  }

  return out;
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
  if (!WP_BASE) return { html: "" };

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
    const res = await fetch(url);
    if (!res.ok) return { html: "" };

    const data = await res.json();

    // Prefer server-selected HTML if available, else full field HTML.
    let html: string = (data?.selected?.html ?? data?.html) || "";
    if (!html) return { html: "", raw: data };

    // Client-side selector fallback
    if (pf.selector && !data?.selected?.html) {
      const bySel = extractBySelector(html, pf.selector);
      if (bySel) html = bySel;
    }

    // Optional: isolate a single row’s HTML by .rowindex-{n}
    if (Number.isFinite(pf.rowIndex)) {
      const byRow = extractByRowIndex(html, pf.rowIndex as number);
      if (byRow) html = byRow;
    }

    // Remove WP wrappers so your Astro wrappers aren’t duplicated
    html = stripRedundantFlexWrappers(html);

    // Rename container classes (no spacing conversion)
    html = mapKnownClassesInHtml(html);

    // Image attrs
    html = fixImagesInHtml(html);

    return { html, raw: data };
  } catch {
    return { html: "" };
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
