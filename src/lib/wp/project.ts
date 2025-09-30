// src/lib/wp/project.ts
import https from "https";

/** =========================
 *  Flags (ENV)
 *  =========================
 *  - WP_PROJECT_CACHE: "1" (default) to enable, "0" to disable caching
 *  - WP_PROJECT_DEBUG: "1" to enable verbose console logging
 */
const CACHE_ENABLED = 1;

const DEBUG = 0;

/** Safe logger */
function dbg(...args: any[]) {
  if (DEBUG) console.log("[wp/project]", ...args);
}

/** =========================
 *  Env + host detection
 *  ========================= */
const WP_URL = import.meta.env.WORDPRESS_API_URL as string | undefined;
const WP_BASE = import.meta.env.WP_BASE_URL as string | undefined;

function isLocalHost(url?: string) {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h.endsWith(".local");
  } catch {
    return false;
  }
}

const isDev = import.meta.env.MODE !== "production";
const isLocal = isLocalHost(WP_URL) || isLocalHost(WP_BASE);

dbg("init", {
  MODE: import.meta.env.MODE,
  WP_URL,
  WP_BASE,
  isDev,
  isLocal,
  CACHE_ENABLED,
  DEBUG,
});

/** Single keep-alive agent for all requests.
 *  - In dev + local, allow self-signed (rejectUnauthorized=false)
 *  - Otherwise, enforce normal TLS
 */
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 12,
  rejectUnauthorized: !(isDev && isLocal),
});

function withTLS(opts: RequestInit = {}): RequestInit {
  // Always reuse the keep-alive agent to avoid repeated TLS handshakes
  return { ...opts, agent };
}

/** =========================
 *  Tiny in-memory TTL cache
 *  ========================= */
type CacheEntry<T> = { value: T; exp: number };

function createTTLCache<T>(ttlMs = 60_000) {
  const map = new Map<string, CacheEntry<T>>();

  function get(key: string): T | undefined {
    const e = map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.exp) {
      map.delete(key);
      return undefined;
    }
    return e.value;
  }

  function set(key: string, value: T) {
    map.set(key, { value, exp: Date.now() + ttlMs });
  }

  async function memo(
    fn: (...args: any[]) => Promise<T>,
    keyer: (...args: any[]) => string,
    ...args: any[]
  ) {
    const key = keyer(...args);
    if (CACHE_ENABLED) {
      const hit = get(key);
      if (hit !== undefined) {
        dbg("cache hit", key);
        return hit;
      }
      dbg("cache miss", key);
    } else {
      dbg("cache disabled, calling raw", keyer(...args));
    }
    const val = await fn(...args);
    if (CACHE_ENABLED) set(key, val);
    return val;
  }

  return { get, set, memo };
}

// Cache featured data for 5 minutes; primary term for 10 minutes
const gqlCache = createTTLCache<any>(5 * 60_000);
const termCache = createTTLCache<any>(10 * 60_000);

/** =========================
 *  Types
 *  ========================= */
type Featured = {
  attachmentId?: number;
  src?: string;
  alt?: string;
  sizes?: Record<string, string>;
};

type PrimaryArea = {
  post_id: number;
  term: null | { term_id: number; name: string; slug: string; taxonomy: string };
};

/** =========================
 *  Low-level fetchers
 *  ========================= */
async function fetchProjectFeaturedRaw(projectDatabaseId: number) {
  dbg("fetchProjectFeaturedRaw:start", { projectDatabaseId });

  const fallback = {
    title: "",
    attachmentId: undefined as number | undefined,
    image: { src: "", alt: "", sizes: {} as Record<string, string> },
  };

  if (!WP_URL) {
    dbg("fetchProjectFeaturedRaw: WP_URL missing");
    return fallback;
  }

  const gql = `
    query ProjectFeatured($id: ID!) {
      project(id: $id, idType: DATABASE_ID) {
        title
        featuredImage {
          node {
            databaseId
            altText
            sourceUrl
            mediaDetails {
              sizes { name sourceUrl }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(
      WP_URL,
      withTLS({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: gql, variables: { id: projectDatabaseId } }),
      })
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      dbg("fetchProjectFeaturedRaw: non-200", { status: res.status, body });
      return fallback;
    }

    const j = await res.json();
    const proj = j?.data?.project;
    const node = proj?.featuredImage?.node;

    const sizes: Record<string, string> = {};
    for (const s of node?.mediaDetails?.sizes || []) {
      if (s?.name && s?.sourceUrl) sizes[s.name] = s.sourceUrl;
    }

    const out = {
      title: proj?.title || "",
      attachmentId: typeof node?.databaseId === "number" ? node.databaseId : undefined,
      image: {
        src: sizes["intch_sm"] || node?.sourceUrl || "",
        alt: node?.altText || "",
        sizes,
      },
    };

    dbg("fetchProjectFeaturedRaw:done", {
      title: out.title,
      attachmentId: out.attachmentId,
      src: out.image.src,
      hasIntchSm: Boolean(sizes["intch_sm"]),
    });

    return out;
  } catch (err) {
    dbg("fetchProjectFeaturedRaw:error", String(err));
    return fallback;
  }
}

async function fetchPrimaryAreaRaw(attachmentId: number): Promise<PrimaryArea> {
  dbg("fetchPrimaryAreaRaw:start", { attachmentId });

  const fallback: PrimaryArea = { post_id: 0, term: null };
  if (!WP_BASE || !attachmentId) {
    dbg("fetchPrimaryAreaRaw: missing WP_BASE or attachmentId");
    return fallback;
  }

  const url = `${WP_BASE}/wp-json/handiwork/v1/image-primary-area/${attachmentId}`;
  try {
    const r = await fetch(url, withTLS());
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      dbg("fetchPrimaryAreaRaw: non-200", { status: r.status, body, url });
      return fallback;
    }
    const json = (await r.json()) as PrimaryArea;
    dbg("fetchPrimaryAreaRaw:done", {
      post_id: json?.post_id,
      term: json?.term ? { name: json.term.name, id: json.term.term_id, slug: json.term.slug } : null,
    });
    return json;
  } catch (err) {
    dbg("fetchPrimaryAreaRaw:error", String(err), { url });
    return fallback;
  }
}

/** Cached (or raw) wrappers */
const getFeatured = (id: number) =>
  gqlCache.memo(fetchProjectFeaturedRaw, (x: number) => `feat:${x}`, id);

const getPrimary = (attachmentId: number) =>
  termCache.memo(fetchPrimaryAreaRaw, (x: number) => `area:${x}`, attachmentId);

/** =========================
 *  Public API
 *  ========================= */
export async function getProjectFeaturedAndArea(projectDatabaseId: number) {
  dbg("getProjectFeaturedAndArea:start", { projectDatabaseId });

  const feat = await getFeatured(projectDatabaseId);

  let areaTitle = "";
  if (feat.attachmentId) {
    const primary = await getPrimary(feat.attachmentId);
    areaTitle = primary?.term?.name || "";
    dbg("getProjectFeaturedAndArea:primary", {
      attachmentId: feat.attachmentId,
      areaTitle,
      hasTerm: Boolean(primary?.term),
    });
  } else {
    dbg("getProjectFeaturedAndArea:no-attachmentId");
  }

  const result = {
    title: feat.title || "",
    areaTitle,
    image: {
      src: feat.image?.src || "",
      alt: feat.image?.alt || "",
      sizes: feat.image?.sizes || {},
    },
  };

  dbg("getProjectFeaturedAndArea:done", {
    title: result.title,
    areaTitle: result.areaTitle,
    hasImage: Boolean(result.image.src),
  });

  return result;
}
