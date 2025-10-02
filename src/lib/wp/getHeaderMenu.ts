// src/lib/wp/getHeaderMenu.ts
import { navQuery } from "@/lib/api"; // uses WORDPRESS_API_URL + WP_AUTH_BASIC

export async function getHeaderMenu(): Promise<string> {
  // Prefer WORDPRESS_API_URL; fall back to WP_BASE_URL
  const gql = (import.meta.env.WORDPRESS_API_URL || "").trim();
  const baseFromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const fallbackBase = (import.meta.env.WP_BASE_URL || "").trim();
  const base = baseFromGql || fallbackBase;

  if (!base) {
    console.warn("[getHeaderMenu] Missing WP_BASE_URL / WORDPRESS_API_URL");
    return ""; // never throw
  }

  const endpoint = new URL("/wp-json/astro/v1/headermenu", base).toString();

  // Basic Auth for WP Engine staging (server-side only)
  const pair = (process.env.WP_AUTH_BASIC || "").trim(); // "user:pass"
  const headers: Record<string, string> = {
    Accept: "application/json, text/html;q=0.9",
    "User-Agent": "NetlifySSR/1.0 (+https://netlify.app)",
  };
  if (pair) {
    const token = Buffer.from(pair, "utf8").toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  try {
    const res = await fetch(endpoint, { headers, cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();

    // Non-OK → log and fall through to GraphQL
    if (!res.ok) {
      console.warn("[getHeaderMenu] HTTP", res.status, "from", endpoint, text.slice(0, 160));
    } else {
      // OK + HTML: many plugins return literal <li>…> or a full <ul>…>
      if (ct.includes("text/html") || /^\s*</.test(text)) return text;

      // OK + JSON: accept several common shapes; tolerate mislabelled content
      if (ct.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
        try {
          const json = JSON.parse(text);
          if (typeof json === "string") return json;
          if (json && typeof json.html === "string") return json.html;
          if (Array.isArray(json) && typeof json[0] === "string") return json.join("\n");
          for (const key of ["menu", "data", "body", "content"]) {
            if (json && typeof (json as any)[key] === "string") return (json as any)[key];
          }
        } catch {
          // If JSON parse fails but body looks like HTML, accept it
          if (/^\s*</.test(text)) return text;
        }
      }
    }
  } catch (e: any) {
    console.error("[getHeaderMenu] REST fetch failed:", e?.message || e);
  }

  // Fallback: build a minimal menu from GraphQL (never throw)
  try {
    const nav = await navQuery();
    const items = nav?.menus?.nodes?.[0]?.menuItems?.nodes ?? [];
    const lis = items.map((it: any) => {
      const href = it?.uri || it?.url || "#";
      const label = it?.label || it?.title || "Menu";
      return `<li class="menu-item"><a href="${href}">${label}</a></li>`;
    });
    return lis.join("\n");
  } catch (e: any) {
    console.error("[getHeaderMenu] GraphQL fallback failed:", e?.message || e);
    return "";
  }
}
