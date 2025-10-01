import { getGraphQLEndpoint, authHeaders } from "./env";

export async function fetchGraphQL<T = any>(query: string, variables?: any): Promise<T | null> {
  const endpoint = getGraphQLEndpoint();
  if (!endpoint) return null;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status} at ${endpoint}\n${text.slice(0,300)}`);
  if (!ct.includes("application/json")) {
    throw new Error(`Expected JSON but got "${ct}" from ${endpoint}\n${text.slice(0,300)}`);
  }
  return JSON.parse(text);
}
