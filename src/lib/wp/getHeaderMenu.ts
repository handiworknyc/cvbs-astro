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
  // Prefer WORDPRESS_API_URL; fall back to WP_BASE_URL
  const gql = getEnv("WORDPRESS_API_URL");
  const baseFromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const fallbackBase = getEnv("WP_BASE_URL");
  const base = baseFromGql || fallbackBase;

  if (!base) {
    console.warn("[getHeaderMenu] Missing WP_BASE_URL / WORDPRESS_API_URL");
    return "";
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
      console.warn("[getHeaderMenu] HTTP", res.status, "from", endpoint, text.slice(0, 160));
    } else {
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
    }
  } catch (e: any) {
    console.error("[getHeaderMenu] REST fetch failed:", e?.message || e);
  }

  // GraphQL fallback (also uses env helper inside api.js after we patch it)
  try {
    const nav = await navQuery();
    const items = nav?.menus?.nodes?.[0]?.menuItems?.nodes ?? [];
    return items
      .map((it: any) => {
        const href = it?.uri || it?.url || "#";
        const label = it?.label || it?.title || "Menu";
        return `<li class="menu-item"><a href="${href}">${label}</a></li>`;
      })
      .join("\n");
  } catch (e: any) {
    console.error("[getHeaderMenu] GraphQL fallback failed:", e?.message || e);
    return "";
  }
}
