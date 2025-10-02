// src/lib/env.ts
export function getEnv(name: string): string {
  // Edge (Deno)
  // @ts-ignore Deno ambient in Edge
  const de = (typeof Deno !== "undefined" && Deno?.env?.get) ? Deno.env.get(name) : undefined;
  if (de?.trim()) return de.trim();

  // Node
  // @ts-ignore process ambient in Node
  const pe = (typeof process !== "undefined" && process?.env?.[name]) ? String(process.env[name]) : undefined;
  if (pe?.trim()) return pe.trim();

  // Build-time (only for NON-secrets you've intentionally exposed)
  // Note: import.meta.env secret values are bundled if you use them; avoid for secrets.
  // @ts-ignore vite/astro injects this
  const me = (typeof import.meta !== "undefined" && import.meta?.env?.[name]) ? String(import.meta.env[name]) : "";
  return me.trim();
}

export function toBase64(s: string): string {
  if (!s) return "";
  try {
    // Edge
    if (typeof btoa === "function") return btoa(s);
    // Node
    // @ts-ignore Buffer is Node only
    if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  } catch { /* ignore */ }
  return "";
}
