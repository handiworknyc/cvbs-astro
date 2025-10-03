// src/lib/wp.js
// Server-only helpers for WordPress GraphQL/REST (Astro/SSR safe).
// IMPORTANT: No dynamic access to import.meta.env — only static property reads.

// ---- Env (static reads only) ----
const IM_WP_GRAPHQL_URL    = import.meta.env.WP_GRAPHQL_URL;
const IM_WORDPRESS_API_URL = import.meta.env.WORDPRESS_API_URL;
const IM_WP_BASE_URL       = import.meta.env.WP_BASE_URL;
const IM_WP_AUTH_BASIC     = import.meta.env.WP_AUTH_BASIC;

/** Pick the first non-empty string. */
function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = (v ?? "").toString().trim();
    if (s) return s;
  }
  return "";
}

/** Resolve the GraphQL endpoint from env; fallback to `${WP_BASE_URL}/graphql`. */
function getGraphQLEndpoint() {
  const direct = firstNonEmpty(
    IM_WP_GRAPHQL_URL,
    IM_WORDPRESS_API_URL,
    process.env.WP_GRAPHQL_URL,
    process.env.WORDPRESS_API_URL,
  );
  if (direct) return direct;

  const base = firstNonEmpty(IM_WP_BASE_URL, process.env.WP_BASE_URL);
  return base ? new URL("/graphql", base).toString() : null;
}

/** Basic auth header from WP_AUTH_BASIC ("user:pass"). */
function authHeaders(extra = {}) {
  const pair = firstNonEmpty(IM_WP_AUTH_BASIC, process.env.WP_AUTH_BASIC);
  if (!pair) return { ...extra };
  const token = Buffer.from(pair, "utf8").toString("base64");
  return { Authorization: `Basic ${token}`, ...extra };
}

/**
 * GraphQL fetcher with Basic Auth + helpful error peeks.
 * Throws on HTTP errors or GraphQL errors.
 */
export async function fetchAPI(query, variables = {}, extraHeaders = {}) {
  const endpoint = getGraphQLEndpoint();
  if (!endpoint) {
    throw new Error(
      "WP GraphQL URL missing. Set WP_GRAPHQL_URL or WORDPRESS_API_URL, or set WP_BASE_URL to infer /graphql."
    );
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    const peek = text.slice(0, 300);
    throw new Error(`GraphQL HTTP ${res.status} at ${endpoint}\n${peek}`);
  }
  if (!ct.includes("application/json")) {
    const peek = text.slice(0, 300);
    throw new Error(`Expected JSON but got "${ct}" from ${endpoint}\n${peek}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const peek = text.slice(0, 300);
    throw new Error(`GraphQL parse error: ${e?.message || e}\n${peek}`);
  }

  if (Array.isArray(json.errors) && json.errors.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

/**
 * Lightweight REST helper with Basic Auth (for fallbacks).
 * Returns { ok, status, json, peek }
 */
export async function fetchREST(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    const peek = (await res.text().catch(() => ""))?.slice(0, 300) || "";
    return { ok: false, status: res.status, json: null, peek };
  }

  const json = await res.json().catch(() => null);
  return { ok: true, status: res.status, json };
}

// Useful for debugging in server logs
export const WP_GRAPHQL_ENDPOINT = getGraphQLEndpoint();
