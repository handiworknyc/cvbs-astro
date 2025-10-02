// src/lib/gf/config.ts

export function getEnvWPBase(): string {
  const wp =
    (import.meta as any).env?.WP_BASE_URL ||
    process.env?.WP_BASE_URL ||
    "";
  return String(wp).replace(/\/+$/, "");
}

function joinPath(base: string, path: string): string {
  if (!base) return path; // relative fallback (same-origin)
  const u = new URL(path.replace(/^\/+/, "/"), base);
  return u.toString();
}

function addQuery(url: string, params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return url;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
    });
    return u.toString();
  } catch {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
  }
}

export function makeRoutes(baseOverride?: string) {
  const base = String(baseOverride || getEnvWPBase()).replace(/\/+$/, "");
  return {
    render: (formId: number, params?: Record<string, string | number | boolean | undefined>) => {
      const path = `/wp-json/astro/v1/gf/render/${formId}`;
      return addQuery(joinPath(base, path), params);
    },
    submit: () => {
      const path = `/wp-json/astro/v1/gf/submit`;
      return joinPath(base, path);
    },
    base,
  };
}
