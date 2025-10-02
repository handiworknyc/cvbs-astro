// src/lib/gf/api.ts
import { makeRoutes } from "./config";

export type SubmitResponse = {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  redirectUrl?: string | null;
  entryId?: number | null;
  raw?: string;
};

const TAG = "[GF]";

/* ------------------------------------------------------------------ */
/* Env & Context helpers                                              */
/* ------------------------------------------------------------------ */

function isServer() {
  return typeof window === "undefined";
}

/** Read env safely in both server & browser.
 * - Server: prefers process.env (runtime)
 * - Browser: falls back to import.meta.env (build-time) — PUBLIC_* only
 */
function getEnv(name: string): string {
  // import.meta only exists in ESM; guard it carefully
  const imeEnv =
    typeof import.meta !== "undefined" && (import.meta as any)?.env
      ? (import.meta as any).env
      : {};
  const pe = typeof process !== "undefined" && (process as any)?.env ? (process as any).env : {};
  return String(pe[name] ?? imeEnv[name] ?? "");
}

// Toggle verbose logs on the server with LOG_GF=1
const LOG_GF = (getEnv("LOG_GF") || "").trim() === "1";
function dbg(...a: any[]) {
  if (isServer() && LOG_GF) console.log(TAG, ...a);
}

/** WP Basic Auth header (server-only). */
function authHeaders(): Record<string, string> {
  const pair = (getEnv("WP_AUTH_BASIC") || "").trim(); // "user:pass"
  if (!pair) return {};
  // btoa on edge/deno, Buffer on node
  let token = "";
  try {
    // @ts-ignore
    token = (globalThis as any).btoa ? (globalThis as any).btoa(pair) : Buffer.from(pair, "utf8").toString("base64");
  } catch {
    // eslint-disable-next-line no-undef
    token = Buffer.from(pair, "utf8").toString("base64");
  }
  return { Authorization: `Basic ${token}` };
}

/** Build the WP base from envs. Prefer WORDPRESS_API_URL (minus /graphql), else WP_BASE_URL. */
function getWpBase(): string | null {
  const gql = (getEnv("WORDPRESS_API_URL") || "").trim(); // e.g. https://site/graphql
  const fromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const base = (getEnv("WP_BASE_URL") || "").trim() || fromGql;
  return base || null;
}

/** Unwrap double-encoded JSON strings if some endpoints return "\"<html>...\"" */
function unwrapMaybeJSONString(raw: string): string {
  const s = raw?.trim();
  if (!s) return s;
  const looksJSONWrapped = s.startsWith('"') && s.endsWith('"') && /\\[nrt"\\/]/.test(s);
  if (!looksJSONWrapped) return s;
  try { return JSON.parse(s); } catch { return s; }
}

/** Local proxy URL for browser posts (avoids CORS/auth in browser). */
function buildProxyURL(baseOverride?: string): string {
  // Only the browser needs an absolute URL; server can post to a relative path.
  if (!isServer() && typeof window !== "undefined" && window.location) {
    const base = (baseOverride ?? (import.meta.env?.BASE_URL ?? "/")).replace(/\/+$/, "/");
    return new URL(base + "api/gf/submit", window.location.origin).toString();
  }
  return "/api/gf/submit";
}

/* ------------------------------------------------------------------ */
/* Render (SSR)                                                       */
/* ------------------------------------------------------------------ */

export async function fetchRenderedHTML(
  formId: number,
  opts?: {
    title?: boolean;
    description?: boolean;
    ajax?: boolean;
    tabindex?: number;
    theme?: string;
    signal?: AbortSignal;
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
    ajax: opts?.ajax ?? 0,
    tabindex: opts?.tabindex ?? 0,
    theme: opts?.theme ?? "gravity-theme",
  });

  try {
    const res = await fetch(url, {
      signal: opts?.signal,
      headers: {
        Accept: "text/html, application/json",
        "User-Agent": "NetlifySSR/1.0 (+https://netlify.app)",
        ...(isServer() ? authHeaders() : {}), // 🔐 only on server
      },
      cache: "no-store",
    });

    const ct = res.headers.get("content-type") || "";
    const txt = await res.text();

    dbg("[render] GET", res.status, ct.split(";")[0], "url:", url);

    if (!res.ok) {
      console.error("[GF render] failed:", res.status, txt.slice(0, 200));
      return null;
    }

    if (ct.includes("application/json")) {
      try {
        const json = JSON.parse(txt);
        if (typeof json === "string") return json;
        if (json && typeof json.html === "string") return json.html;
      } catch { /* treat as HTML */ }
    }

    return unwrapMaybeJSONString(txt);
  } catch (e: any) {
    console.error("[GF render] crashed:", e?.message || e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Submit                                                             */
/* ------------------------------------------------------------------ */

export async function submitJSON(
  formId: number,
  payload: Record<string, any>,
  options?: { viaProxy?: boolean; base?: string; signal?: AbortSignal }
): Promise<SubmitResponse & { raw?: string }> {
  const wpBase = (options?.base || getWpBase() || "").replace(/\/+$/, "");
  const proxyUrl = buildProxyURL();
  const shouldUseProxy = !isServer() || !!options?.viaProxy; // browser → proxy by default

  const directUrl = wpBase ? `${wpBase}/wp-json/astro/v1/gf/submit` : "";
  const url = shouldUseProxy ? proxyUrl : directUrl;

  dbg("[submit] target:", url, "viaProxy:", shouldUseProxy, "wpBase:", wpBase || "(empty)");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(shouldUseProxy ? {} : authHeaders()), // 🔐 attach Basic Auth only for direct server→WP
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

  if (/text\/html/i.test(ct) || /^\s*<!doctype/i.test(text) || /^\s*<html/i.test(text)) {
    console.error(TAG, "HTML response (wrong endpoint / auth challenge). status:", res.status, "URL:", url);
    return { ok: false, message: "Bad response (HTML page from server)", raw: text };
  }

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

  if (typeof data.ok !== "boolean") {
    data.ok = res.ok;
  }
  return data as SubmitResponse & { raw?: string };
}
