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

const TAG = "[submitJSON]";

function dbg(...a: any[]) {
  // flip to false to quiet logs
  const ON = true;
  if (ON) console.log(TAG, ...a);
}

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
): Promise<string> {
  const ROUTES = makeRoutes(opts?.base);
  const url = ROUTES.render(formId, {
    title: opts?.title ? 1 : 0,
    description: opts?.description ? 1 : 0,
    ajax: opts?.ajax ?? 0, // 🔴 keep GF ajax OFF while we debug
    tabindex: opts?.tabindex ?? 0,
    theme: opts?.theme ?? "gravity-theme",
  });

  const res = await fetch(url, { signal: opts?.signal, credentials: "include" });
  const ct = res.headers.get("content-type") || "";
  const txt = await res.text();

  dbg("render GET", res.status, ct.split(";")[0], "url:", url, "first200:", txt.slice(0, 200));

  if (!res.ok) throw new Error(`GF render failed (${res.status}) ${txt.slice(0, 200)}`);
  return unwrapMaybeJSONString(txt);
}

// Build the proxy URL robustly (no BASE_URL games that could produce /404).
function buildProxyURL(): string {
  // In dev this is fine; in prod it respects your base
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "/");
  // new URL ensures absolute URL
  return new URL(base + "api/gf/submit", window.location.origin).toString();
}

export async function submitJSON(
  formId: number,
  payload: Record<string, any>,
  options?: { viaProxy?: boolean; base?: string; signal?: AbortSignal }
): Promise<SubmitResponse & { raw?: string }> {
  const wpBase = (options?.base || "").replace(/\/+$/, "");
  const proxyUrl = buildProxyURL();
  const useProxy = !!options?.viaProxy;

  const url = useProxy ? proxyUrl : `${wpBase}/wp-json/astro/v1/gf/submit`;
  const creds: RequestCredentials = useProxy ? "same-origin" : "include";

  dbg("POST target:", url, "viaProxy:", useProxy, "wpBase:", wpBase || "(empty)");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: creds,
      body: JSON.stringify({ formId, payload }),
      signal: options?.signal,
    });
  } catch (e) {
    console.error(TAG, "network error to", url, e);
    throw e;
  }

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  dbg("HTTP", res.status, ct.split(";")[0], "first200:", text.slice(0, 200));

  // If server gave us HTML, we’re on the wrong route.
  if (/text\/html/i.test(ct) || text.trim().startsWith("<!doctype")) {
    console.error(TAG, "HTML response (wrong endpoint). status:", res.status, "URL:", url);
    return { ok: false, message: "Bad response (HTML page from server)", raw: text };
  }

  // Try JSON (with protection for double-encoded)
  const tryParse = (t: string) => {
    try { return JSON.parse(t); } catch { return null; }
  };

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

  return data;
}
