// src/pages/api/gf/submit.ts
export const prerender = false; // ensure runtime execution

const TAG = "[/api/gf/submit]";
const LOG = (getEnv("LOG_GFSUBMIT") || "").trim() === "1";
const log = (...a: any[]) => LOG && console.log(TAG, ...a);
const err = (...a: any[]) => console.error(TAG, ...a);

// Read env safely in both server & build contexts
function getEnv(name: string): string {
  const ime = (typeof import.meta !== "undefined" && (import.meta as any).env) || {};
  const pe = (typeof process !== "undefined" && (process as any).env) || {};
  return String(pe[name] ?? ime[name] ?? "");
}

// Robust base64 (Node & Edge)
function toBase64(s: string): string {
  try {
    return typeof btoa === "function" ? btoa(s) : Buffer.from(s, "utf8").toString("base64");
  } catch {
    // eslint-disable-next-line no-undef
    return Buffer.from(s, "utf8").toString("base64");
  }
}

// Optional Basic Auth header
function authHeaders(): Record<string, string> {
  const pair = (getEnv("WP_AUTH_BASIC") || "").trim(); // "user:pass"
  return pair ? { Authorization: `Basic ${toBase64(pair)}` } : {};
}

// Build WP base from multiple envs (WORDPRESS_API_URL trims /graphql)
function getWpBase(): string {
  const gql = (getEnv("WORDPRESS_API_URL") || "").trim(); // e.g. https://site/graphql
  const fromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const base = (getEnv("WP_BASE_URL") || getEnv("PUBLIC_WP_BASE_URL") || fromGql || "").replace(/\/+$/, "");
  return base;
}

const WP_BASE = getWpBase();
if (!WP_BASE) console.warn(TAG, "Missing WP_BASE_URL / PUBLIC_WP_BASE_URL / WORDPRESS_API_URL");

// GET → simple probe
export async function GET() {
  return new Response(JSON.stringify({ ok: false, message: "Use POST" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
}

// POST → proxy to WP REST (astro/v1/gf/submit)
export async function POST({ request }: { request: Request }) {
  const reqId = Math.random().toString(36).slice(2, 8);

  try {
    const wpUrl = `${WP_BASE}/wp-json/astro/v1/gf/submit`;
    log(reqId, "incoming POST →", wpUrl, "hasAuth:", Boolean(getEnv("WP_AUTH_BASIC")));

    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      err(reqId, "bad JSON body:", e);
      return new Response(JSON.stringify({ ok: false, message: "Bad JSON" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const upstream = await fetch(wpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(), // ✅ Basic Auth if configured
      },
      body: JSON.stringify(body),
      // credentials: not needed server→server; avoid "include"
    });

    const ct = upstream.headers.get("content-type") || "";
    const text = await upstream.text();
    log(reqId, "← upstream", upstream.status, ct.split(";")[0], "len:", text.length, "head:", text.slice(0, 160));

    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": ct || "application/json",
        "x-gf-proxy": "astro",
      },
    });
  } catch (e: any) {
    err("proxy error:", e?.stack || e);
    return new Response(JSON.stringify({ ok: false, message: "Proxy error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
