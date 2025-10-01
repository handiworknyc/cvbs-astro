// src/lib/gf/api.ts
import { makeRoutes } from "./config";

export type SubmitResponse = {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  redirectUrl?: string | null;
  entryId?: number | null;
  // for debug:
  raw?: string;
};

const TAG = "[GF]";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function isServer() {
  // Astro SSR / Netlify functions
  return typeof window === "undefined";
}

/** Build the WP base from envs */
function getWpBase(): string | null {
  const gql = (import.meta.env.WORDPRESS_API_URL || "").trim();         // e.g. https://clbr.wpenginepowered.com/graphql
  const fromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const base = (import.meta.env.WP_BASE_URL || "").trim() || fromGql;   // e.g. https://clbr.wpenginepowered.com
  return base || null;
}

/** Basic auth header (WP Engine staging). Only used server-side. */
function authHeaders(): Record<string, string> {
  const pair = (process.env.WP_AUTH_BASIC || "").trim(); // "user:pass"
  if (!pair) return {};
  const token = Buffer.from(pair, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

/** Debug logging (server-side only) */
function dbg(...a: any[]) {
  if (isServer()) console.log(TAG, ...a);
}

/** Some endpoints double-encode JSON strings; unwrap if needed */
function unwrapMaybeJSONString(raw: string): string {
  const s = raw?.trim();
  if (!s) return s;
  const looksJSONWrapped = s.startsWith('"') && s.endsWith('"') && /\\[nrt"\\/]/.test(s);
  if (!looksJSONWrapped) return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** Build proxy URL for browser posts */
function buildProxyURL(baseOverride?: string): string {
  const base = (baseOverride ?? import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "/");
  if (!isServer() && typeof window !== "undefined" && window.location) {
    return new URL(base + "api/gf/submit", window.location.origin).toString();
  }
  // Server fallback — relative path (useful if you ever post from SSR)
  return "/api/gf/submit";
}

/* ------------------------------------------------------------------ */
/* Render (SSR)                                                       */
/* ------------------------------------------------------------------ */

/**
 * Render GF form HTML via WP REST.
 * - Returns null on failure (never throws).
 * - Server attaches Basic Auth automatically.
 */
export async function fetchRenderedHTML(
  formId: number,
  opts?: {
    title?: boolean;
    description?: boolean;
    ajax?: boolean;
    tabindex?: number;
    theme?: string;
    signal?: AbortSignal;
    /** override WP base if needed */
    base?: string;
  }
): Promise<string | null> {
  const wpBase = (opts?.base || getWpBase() || "").replace(/\/+$/, "");
  if (!wpBase || !formId) {
    dbg("[render] missing base or formId", { wpBase, formId });
    return null;
  }

  const ROUTES = makeRoutes(wpBase);
  const url = ROUTES.render(formId, {
    title: opts?.title ? 1 : 0,
    description: opts?.description ? 1 : 0,
    ajax: opts?.ajax ?? 0, // keep GF ajax OFF for now
    tabindex: opts?.tabindex ?? 0,
    theme: opts?.theme ?? "gravity-theme",
  });

  try {
    const res = await fetch(url, {
      signal: opts?.signal,
      headers: {
        Accept: "text/html, application/json",
        "User-Agent": "NetlifySSR/1.0 (+https://netlify.app)", // helps with some bot checks
        ...(isServer() ? authHeaders() : {}), // only add Basic Auth on server
      },
      // credentials has no effect in server fetch; in browser, we avoid cross-origin anyway
      cache: "no-store",
    });

    const ct = res.headers.get("content-type") || "";
    const txt = await res.text();

    dbg("[render] GET", res.status, ct.split(";")[0], "url:", url);

    if (!res.ok) {
      console.warn("[GF render] failed:", res.status, txt.slice(0, 200));
      return null;
    }

    // If plugin returns JSON with {html:"..."} or plain string
    if (ct.includes("application/json")) {
      try {
        const json = JSON.parse(txt);
        if (typeof json === "string") return json;
        if (json && typeof json.html === "string") return json.html;
      } catch {
        // fallthrough – treat txt as HTML
      }
    }

    // Otherwise assume HTML body
    return unwrapMaybeJSONString(txt);
  } catch (e: any) {
    console.error("[GF render] crashed:", e?.message || e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Submit                                                             */
/* ------------------------------------------------------------------ */

/**
 * Submit GF via JSON.
 * - In the **browser**, default to the local proxy `/api/gf/submit` to avoid CORS/auth issues.
 * - On the **server**, can post directly to WP with Basic Auth.
 */
export async function submitJSON(
  formId: number,
  payload: Record<string, any>,
  options?: { viaProxy?: boolean; base?: string; signal?: AbortSignal }
): Promise<SubmitResponse & { raw?: string }> {
  const wpBase = (options?.base || getWpBase() || "").replace(/\/+$/, "");
  const proxyUrl = buildProxyURL();
  const shouldUseProxy = !isServer() || !!options?.viaProxy; // browser: always proxy by default

  const directUrl = wpBase ? `${wpBase}/wp-json/astro/v1/gf/submit` : "";
  const url = shouldUseProxy ? proxyUrl : directUrl;

  dbg("[submit] target:", url, "viaProxy:", shouldUseProxy, "wpBase:", wpBase || "(empty)");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(shouldUseProxy ? {} : authHeaders()), // only attach Basic Auth for direct WP calls
      },
      credentials: shouldUseProxy ? "same-origin" : "omit",
      body: JSON.stringify({ formId, payload }),
      signal: options?.signal,
      cache: "no-store",
    });
  } catch (e) {
    console.error(TAG, "network error to", url, e);
    return { ok: false, message: "Network error", raw: String(e) };
  }

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  dbg("[submit] HTTP", res.status, ct.split(";")[0], "first200:", text.slice(0, 200));

  // HTML means we likely hit the wrong endpoint (or got challenged)
  if (/text\/html/i.test(ct) || /^\s*<!doctype/i.test(text) || /^\s*<html/i.test(text)) {
    console.error(TAG, "HTML response (wrong endpoint / auth challenge). status:", res.status, "URL:", url);
    return { ok: false, message: "Bad response (HTML page from server)", raw: text };
  }

  // Try JSON (with protection for double-encoded)
  const tryParse = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

  let data: any = tryParse(text);
  if (typeof data === "string") {
    const inner = tryParse(data);
    if (inner) data = inner;
  }

  if (!data || typeof data !== "object") {
    console.error(TAG, "Non-JSON / unparseable response:", text.slice(0, 200));
    return { ok: false, message: "Bad response", raw: text };
  }

  if (!res.ok) {
    console.error(TAG, "HTTP", res.status, "URL:", url, "body:", data);
  }

  // Expect the function/endpoint to return a shape compatible with SubmitResponse
  // If not, coerce minimally:
  if (typeof data.ok !== "boolean") {
    data.ok = res.ok;
  }
  return data as SubmitResponse & { raw?: string };
}
