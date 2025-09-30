// src/lib/wp/flex/utils.ts
export function normalizeUri(u: string) {
  let s = (u || "/").trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

export function stripTags(input = ""): string {
  return (input || "").replace(/<\/?[^>]+(>|$)/g, "");
}

export function slugify(input = ""): string {
  const s = stripTags(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/&[#A-Za-z0-9]+;/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return s || "";
}

// very small HTML builder for links etc.
export function escapeHtml(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type ThemeColor = string; // e.g. "white", "mint", "purp"
export function bgClassFromTheme(theme?: ThemeColor) {
  // adapt to your naming: PHP uses "{$bgcolor}bg-1" in places
  if (!theme || theme === "none") return "";
  return `${theme}bg-1`; // ex: "mintbg-1"
}
