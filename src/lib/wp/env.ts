export function getGraphQLEndpoint(): string | null {
  const wp = import.meta.env.WORDPRESS_API_URL?.trim();
  const base = import.meta.env.WP_BASE_URL?.trim();
  if (wp) return wp;
  if (base) return new URL("/graphql", base).toString();
  return null;
}

export function authHeaders(): Record<string, string> {
  const pair = (process.env.WP_AUTH_BASIC || "").trim(); // works in Netlify functions
  if (!pair) return {};
  const token = Buffer.from(pair, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}
