// src/lib/wp/getHeaderMenu.ts
import { navQuery } from "@/lib/api";
import { getEnv, toBase64 } from "@/lib/env";

function basicAuthHeader(): Record<string, string> {
  const pair = getEnv("WP_AUTH_BASIC"); // "user:pass"
  if (!pair) return {};
  const token = toBase64(pair);
  return token ? { Authorization: `Basic ${token}` } : {};
}

export async function getHeaderMenu(): Promise<string> {
  const gql = getEnv("WORDPRESS_API_URL");
  const baseFromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const fallbackBase = getEnv("WP_BASE_URL");
  const base = baseFromGql || fallbackBase;

  if (!base) {
    return "<!-- MENU_ERROR: Missing WP_BASE_URL / WORDPRESS_API_URL -->";
  }

  const endpoint = new URL("/wp-json/astro/v1/headermenu", base).toString();
  const headers: Record<string, string> = {
    Accept: "application/json, text/html;q=0.9",
    "User-Agent": "NetlifyEdge/1.0",
    ...basicAuthHeader(),
  };

  try {
    const res = await fetch(endpoint, { headers, cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();

    if (!res.ok) {
      // 🔴 Surface status + snippet in the HTML so you can view-source on prod
      const snippet = text.replace(/\s+/g, " ").slice(0, 220);
      return `<!-- MENU_ERROR: HTTP ${res.status} ${endpoint} CT=${ct} BODY="${snippet}" -->`;
    }

    if (ct.includes("text/html") || /^\s*</.test(text)) return text;

    if (ct.includes("application/json") || /^[\s\r\n]*[{[]/.test(text)) {
      try {
        const json = JSON.parse(text);
        if (typeof json === "string") return json;
        if (json && typeof json.html === "string") return json.html;
        if (Array.isArray(json) && typeof json[0] === "string") return json.join("\n");
        for (const key of ["menu", "data", "body", "content"]) {
          if (json && typeof (json as any)[key] === "string") return (json as any)[key];
        }
      } catch {
        if (/^\s*</.test(text)) return text;
      }
    }
  } catch (e: any) {
    return `<!-- MENU_ERROR: fetch failed ${endpoint} MSG="${(e?.message || String(e)).slice(0, 220)}" -->`;
  }

  // GraphQL fallback
  try {
    const nav = await navQuery();
    const items = nav?.menus?.nodes?.[0]?.menuItems?.nodes ?? [];
    return items.map((it: any) => {
      const href = it?.uri || it?.url || "#";
      const label = it?.label || it?.title || "Menu";
      return `<li class="menu-item"><a href="${href}">${label}</a></li>`;
    }).join("\n");
  } catch (e: any) {
    return `<!-- MENU_ERROR: GraphQL fallback failed MSG="${(e?.message || String(e)).slice(0, 220)}" -->`;
  }
}
