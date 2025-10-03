// src/lib/wp/rewriteImages.ts
import * as cheerio from 'cheerio';

function mapSrcset(srcset: string, mapUrl: (u: string) => string): string {
  return srcset
    .split(',')
    .map(part => {
      const [url, size] = part.trim().split(/\s+/, 2);
      return [mapUrl(url), size].filter(Boolean).join(' ');
    })
    .join(', ');
}

export function rewriteImagesToProxy(html: string, wpHost: string): string {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  const mapUrl = (u: string) => {
    try {
      const abs = new URL(u, `https://${wpHost}`);
      if (abs.hostname !== wpHost) return u; // only rewrite WP images
      return `/api/img?u=${encodeURIComponent(abs.toString())}`;
    } catch {
      return u;
    }
  };

  $('img').each((_, el) => {
    const $img = $(el);
    // src / data-src
    const src = $img.attr('src') || $img.attr('data-src');
    if (src) $img.attr('src', mapUrl(src));

    // srcset / data-srcset
    const ss = $img.attr('srcset') || $img.attr('data-srcset');
    if (ss) $img.attr('srcset', mapSrcset(ss, mapUrl));
  });

  return $.html();
}
