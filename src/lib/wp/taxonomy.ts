type Term = { id: number; name: string; slug: string; tax: string; link: string };
type MaybeTerm = Term | null;

const WP_BASE =
  (import.meta.env.WP_BASE_URL as string | undefined) ||
  (import.meta.env.PUBLIC_WP_BASE_URL as string | undefined) ||
  "";

function baseUrl(path: string) {
  const base = WP_BASE.replace(/\/+$/, "");
  return `${base}${path}`;
}

// Simple per-request memo cache to avoid duplicate network calls
const memo = new Map<string, Promise<any>>();
function mfetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (!memo.has(key)) memo.set(key, fetcher());
  return memo.get(key)!;
}

/** Primary term for a single post+taxonomy */
export async function getPrimaryTerm(postId: number, tax: string): Promise<MaybeTerm> {
  const url = new URL(baseUrl('/wp-json/astro/v1/primary-term'));
  url.searchParams.set('post', String(postId));
  url.searchParams.set('tax', tax);

  return mfetch(url.toString(), async () => {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = await res.json() as { term: MaybeTerm };
    return json.term ?? null;
  });
}

/** Primary term *name* convenience */
export async function getPrimaryTermName(postId: number, tax: string): Promise<string> {
  const term = await getPrimaryTerm(postId, tax);
  return term?.name ?? "";
}

/** Batch primary term lookup for many posts (same taxonomy) */
export async function getPrimaryTermsBatch(postIds: number[], tax: string): Promise<Record<number, MaybeTerm>> {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  if (!ids.length) return {};
  const url = new URL(baseUrl('/wp-json/astro/v1/primary-term/batch'));
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('tax', tax);

  return mfetch(url.toString(), async () => {
    const res = await fetch(url.toString());
    if (!res.ok) return {};
    return (await res.json()) as Record<number, MaybeTerm>;
  });
}

/** All terms on a post for a taxonomy (ordered) */
export async function getTerms(postId: number, tax: string): Promise<Term[]> {
  const url = new URL(baseUrl('/wp-json/astro/v1/terms'));
  url.searchParams.set('post', String(postId));
  url.searchParams.set('tax', tax);

  return mfetch(url.toString(), async () => {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    return (await res.json()) as Term[];
  });
}

/** Helper to enrich a list of rows with tag/location via batch calls */
export async function enrichWithPrimaryTerms<T extends { projectId?: number }>(
  rows: T[],
  opts: { tagTax?: string; locationTax?: string } = {}
) {
  const { tagTax, locationTax } = opts;
  const ids = rows.map(r => r.projectId).filter((v): v is number => !!v);

  const [tagsById, locsById] = await Promise.all([
    tagTax ? getPrimaryTermsBatch(ids, tagTax) : Promise.resolve<Record<number, MaybeTerm>>({}),
    locationTax ? getPrimaryTermsBatch(ids, locationTax) : Promise.resolve<Record<number, MaybeTerm>>({})
  ]);

  return rows.map(r => {
    const id = r.projectId ?? 0;
    const tagTerm = tagTax ? tagsById[id] : null;
    const locTerm = locationTax ? locsById[id] : null;
    return {
      ...r,
      tag: (r as any).tag ?? (tagTerm?.name ?? null),
      location: (r as any).location ?? (locTerm?.name ?? null),
      __terms: {
        tag: tagTerm,
        location: locTerm
      }
    };
  });
}