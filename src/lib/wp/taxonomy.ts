// src/lib/wp/primary-terms.ts
type Term = { id: number; name: string; slug: string; tax: string; link: string };
type MaybeTerm = Term | null;

/* ---------- Env + base resolution ---------- */
function getBase(): string | null {
  const gql = (import.meta.env.WORDPRESS_API_URL as string | undefined)?.trim(); // e.g. https://.../graphql
  const fromGql = gql ? gql.replace(/\/graphql\/?$/i, "") : "";
  const base =
    (import.meta.env.WP_BASE_URL as string | undefined)?.trim() ||
    fromGql ||
    (import.meta.env.PUBLIC_WP_BASE_URL as string | undefined)?.trim() ||
    "";
  return base || null;
}

function baseUrl(path: string) {
  const base = getBase();
  return base ? `${base.replace(/\/+$/, "")}${path}` : path;
}

function isServer() {
  return typeof window === "undefined";
}

/* ---------- Auth + fetch helpers (server only for Basic Auth) ---------- */
function authHeaders(): Record<string, string> {
  if (!isServer()) return {};
  const pair = (process.env.WP_AUTH_BASIC || "").trim(); // "user:pass"
  if (!pair) return {};
  const token = Buffer.from(pair, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function fetchJSON<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "NetlifySSR/1.0 (+https://netlify.app)",
        ...authHeaders(),
      },
      cache: "no-store",
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();

    if (!res.ok) {
      console.warn("[primary-terms] HTTP", res.status, url, text.slice(0, 160));
      return null;
    }

    // Tolerate mislabelled content; try JSON first
    try {
      return JSON.parse(text) as T;
    } catch {
      // If it looks like HTML (e.g., auth challenge), bail gracefully
      if (/^\s*</.test(text)) {
        console.warn("[primary-terms] HTML body from", url);
        return null;
      }
      return null;
    }
  } catch (e: any) {
    console.error("[primary-terms] fetch failed:", e?.message || e, url);
    return null;
  }
}

/* ---------- Per-request memo ---------- */
const memo = new Map<string, Promise<any>>();
function mfetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (!memo.has(key)) memo.set(key, fetcher());
  return memo.get(key)! as Promise<T>;
}

/* ---------- API ---------- */

/** Primary term for a single post+taxonomy */
export async function getPrimaryTerm(postId: number, tax: string): Promise<MaybeTerm> {
  const u = new URL(baseUrl("/wp-json/astro/v1/primary-term"));
  u.searchParams.set("post", String(postId));
  u.searchParams.set("tax", tax);

  return mfetch(u.toString(), async () => {
    const json = await fetchJSON<{ term: MaybeTerm }>(u.toString());
    return json?.term ?? null;
  });
}

/** Primary term *name* convenience */
export async function getPrimaryTermName(postId: number, tax: string): Promise<string> {
  const term = await getPrimaryTerm(postId, tax);
  return term?.name ?? "";
}

/** Batch primary term lookup for many posts (same taxonomy) */
export async function getPrimaryTermsBatch(
  postIds: number[],
  tax: string
): Promise<Record<number, MaybeTerm>> {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  if (!ids.length) return {};
  const u = new URL(baseUrl("/wp-json/astro/v1/primary-term/batch"));
  u.searchParams.set("ids", ids.join(","));
  u.searchParams.set("tax", tax);

  return mfetch(u.toString(), async () => {
    const json = await fetchJSON<Record<number, MaybeTerm>>(u.toString());
    return json ?? {};
  });
}

/** All terms on a post for a taxonomy (ordered) */
export async function getTerms(postId: number, tax: string): Promise<Term[]> {
  const u = new URL(baseUrl("/wp-json/astro/v1/terms"));
  u.searchParams.set("post", String(postId));
  u.searchParams.set("tax", tax);

  return mfetch(u.toString(), async () => {
    const json = await fetchJSON<Term[]>(u.toString());
    return json ?? [];
  });
}

/** Helper to enrich a list of rows with tag/location via batch calls */
export async function enrichWithPrimaryTerms<T extends { projectId?: number }>(
  rows: T[],
  opts: { tagTax?: string; locationTax?: string } = {}
) {
  const { tagTax, locationTax } = opts;
  const ids = rows.map((r) => r.projectId).filter((v): v is number => !!v);

  const [tagsById, locsById] = await Promise.all([
    tagTax ? getPrimaryTermsBatch(ids, tagTax) : Promise.resolve<Record<number, MaybeTerm>>({}),
    locationTax ? getPrimaryTermsBatch(ids, locationTax) : Promise.resolve<Record<number, MaybeTerm>>({}),
  ]);

  return rows.map((r) => {
    const id = r.projectId ?? 0;
    const tagTerm = tagTax ? tagsById[id] : null;
    const locTerm = locationTax ? locsById[id] : null;
    return {
      ...r,
      tag: (r as any).tag ?? (tagTerm?.name ?? null),
      location: (r as any).location ?? (locTerm?.name ?? null),
      __terms: {
        tag: tagTerm,
        location: locTerm,
      },
    };
  });
}
