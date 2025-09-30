// src/lib/images/index.ts

export type FeaturedEntry = {
  alt?: string;
  sizes?: { xl?: string | null; lg?: string | null; med?: string | null; sm?: string | null };
  src?: string | null;     // legacy top-level
  descriptors?: { xl: number; lg: number; med: number; sm: number };
  dims?: any;
};

export type ImagesMap = {
  xl?: string | null;
  large?: string | null;   // maps to 'lg'
  med?: string | null;
  small?: string | null;
};

export const DEFAULT_DESCRIPTORS = { xl: 1700, lg: 1400, med: 1000, sm: 600 } as const;

/** Convert a /featured/batch entry to SmartImage 'images' map */
export function toImagesMap(entry?: FeaturedEntry | null): ImagesMap {
  if (!entry) return {};
  const s = entry.sizes || {};
  return {
    xl: s.xl ?? entry.src ?? null,
    large: s.lg ?? null,
    med: s.med ?? null,
    small: s.sm ?? null,
  };
}

/** Build a width-descriptor srcset string from an ImagesMap. */
export function toSrcSet(images: ImagesMap, descriptors = DEFAULT_DESCRIPTORS): string {
  const parts: string[] = [];
  if (images.xl)    parts.push(`${images.xl} ${descriptors.xl}w`);
  if (images.large) parts.push(`${images.large} ${descriptors.lg}w`);
  if (images.med)   parts.push(`${images.med} ${descriptors.med}w`);
  if (images.small) parts.push(`${images.small} ${descriptors.sm}w`);
  return parts.join(', ');
}

/**
 * Convenience “one-liner” to prep props for <SmartImage>.
 * - Uses data-srcset by default (critical=false)
 * - sizes defaults to "100vw" (override per-template)
 */
export function buildSmartImageProps(entry?: FeaturedEntry | null, opts?: {
  sizes?: string;
  alt?: string;
  critical?: boolean;
  imgClass?: string;
  crossorigin?: '' | 'anonymous' | 'use-credentials';
}) {
  const images = toImagesMap(entry);
  return {
    images,
    sizes: opts?.sizes ?? '100vw',
    alt: opts?.alt ?? (entry?.alt ?? ''),
    critical: !!opts?.critical,
    imgClass: opts?.imgClass ?? '',
    crossorigin: opts?.crossorigin,
  };
}
