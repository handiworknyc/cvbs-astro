// src/lib/wp.js
// Server-only helpers for WordPress GraphQL on Netlify/SSR.

function getGraphQLEndpoint() {
  const wp = (import.meta.env.WORDPRESS_API_URL || import.meta.env.WP_GRAPHQL_URL || "").trim();
  if (wp) return wp;
  const base = (import.meta.env.WP_BASE_URL || "").trim();
  return base ? new URL("/graphql", base).toString() : null;
}

function authHeaders() {
  // Read "user:pass" from env; Netlify functions expose process.env
  const pair = (process.env.WP_AUTH_BASIC || "").trim();
  if (!pair) return {};
  const token = Buffer.from(pair, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

export async function fetchAPI(query, variables = {}) {
  const endpoint = getGraphQLEndpoint();
  if (!endpoint) {
    throw new Error(
      "WP GraphQL URL missing. Set WORDPRESS_API_URL or WP_BASE_URL (and optionally WP_AUTH_BASIC)."
    );
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status} at ${endpoint}\n${text.slice(0, 300)}`);
  }
  if (!ct.includes("application/json")) {
    throw new Error(`Expected JSON but got "${ct}" from ${endpoint}\n${text.slice(0, 300)}`);
  }

  const json = JSON.parse(text);
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}
