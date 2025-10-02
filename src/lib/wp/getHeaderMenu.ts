// src/lib/wp/getHeaderMenu.ts
import { navQuery } from "@/lib/api"; // uses WORDPRESS_API_URL + WP_AUTH_BASIC

function basicAuthHeader(pair: string | undefined | null): Record<string, string> {
  const s = (pair || "").trim();
  if (!s) return {};
  try {
    // Edge (Deno) has btoa; Node has Buffer.
    const token =
      typeof btoa === "function" ? btoa(s) :
      // @ts-ignore - Buffer may not exist in Edge
      (typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : "");
    return token ? { Authorization: `Basic ${token}` } : {};
  } catch {
    return {};
  }
}

export async function getHeaderMenu(): Promise<string> {
  const gql = (process.env.WORDPRESS_API_URL || "").trim();
  const baseFromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const fallbackBase = (import.meta.env.WP_BASE_URL || "").trim();
  const base = baseFromGql || fallbackBase;

  if (!base) {
    console.warn("[getHeaderMenu] Missing WP_BASE_URL / WORDPRESS_API_URL");
    return "";
  }

  const endpoint = new URL("/wp-json/astro/v1/headermenu", base).toString();

  const headers: Record<string, string> = {
    Accept: "application/json, text/html;q=0.9",
    "User-Agent": "NetlifySSR/1.0 (+https://netlify.app)",
    ...basicAuthHeader(process.env.WP_AUTH_BASIC),
  };

  try {
    const res = await fetch(endpoint, { headers, cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();

    if (!res.ok) {
      console.warn("[getHeaderMenu] HTTP", res.status, "from", endpoint, text.slice(0, 160));
    } else {
      if (ct.includes("text/html") || /^\s*</.test(text)) return text;
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
          if (/^\s*</.test(text)) return text;
        }
      }
    }
  } catch (e: any) {
    console.error("[getHeaderMenu] REST fetch failed:", e?.message || e);
  }

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
