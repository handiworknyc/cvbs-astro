// src/lib/wp/getHeaderMenu.ts
import { navQuery } from "@/lib/api";
import { getEnv, toBase64 } from "@/lib/env";

/** Edge/Node-safe Basic Auth header */
function basicAuthHeader(): Record<string, string> {
  const pair = getEnv("WP_AUTH_BASIC"); // "user:pass"
  if (!pair) return {};
  const token = toBase64(pair);
  return token ? { Authorization: `Basic ${token}` } : {};
}

/** Treat tiny/blank as unusable */
function looksEmptyMenu(s: string | null | undefined): boolean {
  const t = String(s ?? "").trim();
  if (!t) return true;
  // If it’s HTML, require at least some tags
  if (/^</.test(t)) return !/<li\b|<ul\b|<a\b/i.test(t);
  // If it’s plain text, require some visible chars
  return t.length < 3;
}

export async function getHeaderMenu(): Promise<string> {
  // Prefer WORDPRESS_API_URL; fall back to WP_BASE_URL
  const gql = getEnv("WORDPRESS_API_URL");
  const baseFromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const fallbackBase = getEnv("WP_BASE_URL");
  const base = baseFromGql || fallbackBase;

  if (!base) {
    console.warn("[getHeaderMenu] Missing WP_BASE_URL / WORDPRESS_API_URL");
    return await fallbackGraphQL();
  }

  const endpoint = new URL("/wp-json/astro/v1/headermenu", base).toString();
  const headers: Record<string, string> = {
    Accept: "application/json, text/html;q=0.9",
    "User-Agent": "NetlifyRuntime/1.0",
    ...basicAuthHeader(),
  };

  try {
    const res = await fetch(endpoint, { headers, cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();

    if (!res.ok) {
      console.warn("[getHeaderMenu] HTTP", res.status, "from", endpoint, text.slice(0, 160));
      return await fallbackGraphQL();
    }

    // HTML body straight through
    if (ct.includes("text/html") || /^\s*</.test(text)) {
      if (looksEmptyMenu(text)) return await fallbackGraphQL();
      return text;
    }

    // JSON or mislabeled JSON
    if (ct.includes("application/json") || /^[\s\r\n]*[{[]|^"/.test(text)) {
      try {
        const json = JSON.parse(text);
        let candidate: string | null = null;

        if (typeof json === "string") candidate = json;                     // e.g. "" or "<li>…"
        else if (json && typeof json.html === "string") candidate = json.html;
        else if (Array.isArray(json) && typeof json[0] === "string") candidate = json.join("\n");
        else {
          for (const key of ["menu", "data", "body", "content"]) {
            const val = (json as any)?.[key];
            if (typeof val === "string") { candidate = val; break; }
          }
        }

        if (!candidate || looksEmptyMenu(candidate)) {
          // REST returned empty → fall back
          return await fallbackGraphQL();
        }
        return candidate;
      } catch {
        // Non-parseable but maybe it’s HTML
        if (/^\s*</.test(text) && !looksEmptyMenu(text)) return text;
        return await fallbackGraphQL();
      }
    }

    // Unknown content-type → try GraphQL
    return await fallbackGraphQL();
  } catch (e: any) {
    console.error("[getHeaderMenu] REST fetch failed:", e?.message || e);
    return await fallbackGraphQL();
  }
}

/** GraphQL fallback builder (never throws) */
async function fallbackGraphQL(): Promise<string> {
  try {
    const nav = await navQuery();
    const items = nav?.menus?.nodes?.[0]?.menuItems?.nodes ?? [];
    if (!Array.isArray(items) || items.length === 0) return "";
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
