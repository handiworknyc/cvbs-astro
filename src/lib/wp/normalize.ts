// src/lib/wp/flex/normalize.ts
import { bgClassFromTheme, escapeHtml, slugify } from "./utils";

type AnyRec = Record<string, any>;

export type RawRow = AnyRec & {
  acf_fc_layout?: string;
  name?: string;     // if you already normalized server-side
  key?: string;
  section_content?: AnyRec[]; // nested repeater in your JSON, if present
  bg_color?: AnyRec;          // if you surface settings/bg in your JSON
};

export type NormRow = {
  name: string;
  key: string;
  data: AnyRec;
  meta: {
    id?: string;           // value (no #)
    classes: string[];     // wrapper classes
    preHtml?: string;      // rendered “section_content”
    index: number;         // 1-based
    next?: { name?: string; bg?: string };
    flags: {
      hasSecContent: boolean;
      isLast: boolean;
      isHeroNoBg: boolean;
    };
  };
};

function getLayoutName(raw: RawRow) {
  return raw.name || raw.acf_fc_layout || "unknown";
}

function computeIdFromRow(raw: AnyRec): string | undefined {
  // PHP: prefers section_id, else title, else special cases
  const sectionId = raw.section_id;
  const title = raw.title;

  if (sectionId && typeof sectionId === "string") {
    const s = slugify(sectionId);
    return s || undefined;
  }
  if (title && typeof title === "string") {
    const s = slugify(title);
    return s || undefined;
  }
  if (raw.acf_fc_layout === "faqs") return "faq";
  if (raw.acf_fc_layout === "product_bundles") return "buy";
  return undefined;
}

function renderSectionContent(rows: AnyRec[] | undefined): { html?: string; has: boolean } {
  if (!Array.isArray(rows) || !rows.length) return { has: false };

  const out: string[] = [];
  for (const r of rows) {
    const sectitle = r?.title ?? "";
    const sectext = r?.text ?? "";
    const seclabel = r?.label ?? "";
    const seclink = r?.link; // { url, title }
    const ctaBelow = !!r?.cta_below;

    const labelHtml = seclabel
      ? `<div class='zeta title-lh caps zeta-alt mb2'>${seclabel}</div>`
      : "";

    const titleHtml = sectitle
      ? `<h3 class='alpha alpha-alt'>${sectitle}</h3>`
      : "";

    const textHtml = sectext
      ? `<div class='zeta post-content mt2-1400 mt1h'>${sectext}</div>`
      : "";

    const linkHtml = seclink?.url
      ? `<a class='btn delta delta-alt mt2 mt3-760' href='${escapeHtml(seclink.url)}'>${escapeHtml(seclink.title || "Learn more")}</a>`
      : "";

    const linkAbove = seclink?.url && !ctaBelow ? linkHtml : "";
    const linkBelow = seclink?.url && ctaBelow
      ? `<div class='container-fluid tac mt3-760 mt1h'>${linkHtml}</div>`
      : "";

    const block = `
      <div class='section-content tac pb5h-760 pb3 pt5h-760 pt3 pt7-1400 pb7-1400 container-fluid'>
        ${labelHtml}${titleHtml}${textHtml}${linkAbove}
      </div>
      ${linkBelow}
    `;
    out.push(block);
  }
  return { html: out.join(""), has: out.length > 0 };
}

// very light bg/hero flags similar to your PHP
function computeFlags(name: string, raw: AnyRec): { isHeroNoBg: boolean } {
  let isHeroNoBg = false;
  if (name === "hero_text" && raw?.add_yt !== true && !raw?.image) {
    isHeroNoBg = true;
  }
  return { isHeroNoBg };
}

export function normalizeLayouts(rawLayouts: RawRow[]): NormRow[] {
  if (!Array.isArray(rawLayouts)) return [];

  // Pre-scan to determine next layout names/colors
  const names = rawLayouts.map((r) => getLayoutName(r));

  return rawLayouts.map((raw, idx) => {
    const name = getLayoutName(raw);
    const index = idx + 1;
    const nextName = names[idx + 1];

    // section_content -> preHtml
    const { html: preHtml, has: hasSecContent } = renderSectionContent(raw.section_content);

    // Row bg/theme — adapt to your JSON: keep simple, string or nested
    const themeLabel =
      typeof raw?.bg_color === "string"
        ? raw.bg_color
        : (raw?.bg_color?.label || raw?.bg_color?.value || raw?.bg_color);
    const bgClass = bgClassFromTheme(themeLabel);

    const { isHeroNoBg } = computeFlags(name, raw);

    const id = computeIdFromRow(raw);
    const classes = [
      "flex-module",
      `${name}-module`,
      `rowindex-${index}`,
      bgClass ? `has-bg ${bgClass}` : "",
      isHeroNoBg ? "hero-no-bg" : "",
      // emulate “next-<name>” class
      nextName ? `next-${nextName}` : "",
    ].filter(Boolean);

    const meta: NormRow["meta"] = {
      id,
      classes,
      preHtml,
      index,
      next: { name: nextName, bg: "" },
      flags: { hasSecContent, isLast: !nextName, isHeroNoBg },
    };

    // strip known meta keys from data
    const {
      acf_fc_layout, name: _n, key: _k,
      section_content, bg_color,
      ...data
    } = raw;

    return {
      name,
      key: raw.key || `${name}-${index}`,
      data,
      meta,
    };
  });
}
