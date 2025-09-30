// src/lib/wp.js
export async function fetchAPI(query, variables = {}) {
  const url = import.meta.env.WP_GRAPHQL_URL || import.meta.env.WORDPRESS_API_URL;
  if (!url) throw new Error("WP GraphQL URL missing. Set WP_GRAPHQL_URL in .env");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch {
      throw new Error(`Non-JSON from WP: ${text.slice(0, 300)}…`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json.errors || json)}`);
    if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    return json.data;
  } catch (err) {
    const code = err?.cause?.code || err?.code || "";
    console.error("WP fetch failed", code, err);
    throw err;
  }
}
