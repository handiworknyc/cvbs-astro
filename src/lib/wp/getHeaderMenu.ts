// src/lib/wp/getHeaderMenu.ts
import { navQuery } from "@/lib/api"; // uses WORDPRESS_API_URL + WP_AUTH_BASIC

export async function getHeaderMenu(): Promise<string> {
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
  const headers: Record<string, string> = { Accept: "application/json" };
  if (pair) {
    const token = Buffer.from(pair, "utf8").toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  try {
    const res = await fetch(endpoint, { headers });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();

    // Accept HTML (plugin might output raw <li>…> or <ul>…)
    if (res.ok && !ct.includes("application/json") && /^\s*</.test(text)) {
      return text;
    }

    if (res.ok && ct.includes("application/json")) {
      const json = JSON.parse(text);
      if (typeof json === "string") return json;
      if (json && typeof json.html === "string") return json.html;
      if (Array.isArray(json) && typeof json[0] === "string") return json.join("\n");
      for (const key of ["menu", "data", "body", "content"]) {
        if (json && typeof json[key] === "string") return json[key];
      }
    }
    // fall through to GraphQL if not ok / unexpected
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
