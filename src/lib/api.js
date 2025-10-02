// src/lib/api.js
import { fetchAPI } from "./wp.js";
import { getEnv, toBase64 } from "./env.ts"; // note .ts import is fine with Vite/TS

function authHeaders() {
  const pair = getEnv("WP_AUTH_BASIC");
  if (!pair) return {};
  const token = toBase64(pair);
  return token ? { Authorization: `Basic ${token}` } : {};
}

function getGraphQLEndpoint() {
  const wp = getEnv("WORDPRESS_API_URL");
  const base = getEnv("WP_BASE_URL");
  if (wp) return wp;
  if (base) return new URL("/graphql", base).toString();
  return null;
}

async function fetchGraphQL(query, variables) {
  const endpoint = getGraphQLEndpoint();
  if (!endpoint) return null;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status} at ${endpoint}\n${text.slice(0, 300)}`);
  if (!ct.includes("application/json")) throw new Error(`Expected JSON but got "${ct}" from ${endpoint}\n${text.slice(0, 300)}`);

  return JSON.parse(text);
}

export async function navQuery() {
  const q = `{
    menus(where: {location: PRIMARY}) {
      nodes {
        name
        menuItems(first: 200) {
          nodes {
            id databaseId parentId parentDatabaseId
            parent { node { id databaseId } }
            label uri url cssClasses target title xfn order
          }
        }
      }
    }
    generalSettings { title url description }
  }`;

  try {
    const json = await fetchGraphQL(q);
    const data = json?.data || {};
    return {
      menus: data.menus ?? { nodes: [] },
      generalSettings: data.generalSettings ?? { title: "", url: "", description: "" },
    };
  } catch {
    return { menus: { nodes: [] }, generalSettings: { title: "", url: "", description: "" } };
  }
}


export async function homePagePostsQuery() {
  const q = `{
    posts {
      nodes {
        date uri title commentCount excerpt
        categories { nodes { name uri } }
        featuredImage { node { srcSet sourceUrl altText mediaDetails { height width } } }
      }
    }
  }`;

  try {
    const json = await fetchGraphQL(q);
    return json?.data ?? { posts: { nodes: [] } };
  } catch {
    return { posts: { nodes: [] } };
  }
}

// Recent Projects for home
export async function homePagePortfolioQuery() {
  return fetchAPI(`
    query HomeProjects($first: Int = 12) {
      posts: projects(first: $first, where: { orderby: { field: DATE, order: DESC } }) {
        nodes { uri title }
      }
    }
  `);
}

// Resolve any URI to a WP node
export async function getNodeByURI(uri) {
  const q = `
    query GetNodeByURI($uri: String!) {
      nodeByUri(uri: $uri) {
        __typename
        ... on Project {
          id uri title content
          featuredImage { node { sourceUrl srcSet altText } }
          portfolioInfo { excerpt date link subtitle }
        }
        ... on Post {
          id uri title excerpt date content
          categories { nodes { name uri } }
          featuredImage { node { sourceUrl srcSet altText } }
        }
        ... on Page {
          id uri title content
          featuredImage { node { sourceUrl srcSet altText } }
        }
        ... on Category { id name uri }
        ... on Tag { id name uri }
      }
    }
  `;
  try {
    const json = await fetchGraphQL(q, { uri });
    return json?.data ?? null;
  } catch {
    return null;
  }
}

// Collect all URIs (kept as-is; ensure your route expects `params.uri`)
export async function getAllUris() {
  const q = `query GetAllUris {
    terms { nodes { uri } }
    posts(first: 100) { nodes { uri } }
    pages(first: 100) { nodes { uri } }
    projects(first: 100) { nodes { uri } }
  }`;

  try {
    const json = await fetchGraphQL(q);
    const data = json?.data || {};

    const allNodes = Object.values(data).reduce((acc, group) => {
      if (group?.nodes) acc = acc.concat(group.nodes);
      return acc;
    }, []);

    const uris = allNodes
      .filter((n) => n?.uri)
      .map((n) => {
        const trimmed = n.uri.replace(/^\/|\/$/g, "");
        return { params: { uri: trimmed } }; // <-- make sure your route param name matches this
      });

    return uris;
  } catch {
    return [];
  }
}

/* ===========================================
 * Flexible-content (file-based) helpers
 * =========================================== */

// Eagerly import JSON written by your sync script
const pageMods = import.meta.glob("/src/content/wp/pages/*.json", { eager: true });
const serviceMods = import.meta.glob("/src/content/wp/tax/service/*.json", { eager: true });
const serviceAreaMods = import.meta.glob("/src/content/wp/tax/service-area/*.json", { eager: true });

// Utilities
function normalizeUri(u) {
  let s = (u || "/").trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

function slugParamFromUri(uri) {
  // Return a *string* param for Astro routes (not an array)
  return (uri || "").replace(/^\/|\/$/g, ""); // "service/foo/bar"
}

function indexByUri(mods) {
  const out = new Map();
  Object.values(mods).forEach((m) => {
    const data = m && m.default ? m.default : m;
    if (data && data.uri) out.set(normalizeUri(data.uri), data);
  });
  return out;
}

function listFromMods(mods) {
  const out = [];
  Object.values(mods).forEach((m) => {
    const data = m && m.default ? m.default : m;
    if (data) out.push(data);
  });
  return out;
}

// Precomputed collections
const PAGES_BY_URI = indexByUri(pageMods);
const SERVICE_TERMS = listFromMods(serviceMods);
const SERVICE_AREA_TERMS = listFromMods(serviceAreaMods);

// ---- Pages
export function getFlexiblePageByUri(uri) {
  return PAGES_BY_URI.get(normalizeUri(uri)) || null;
}

export function getAllFlexiblePagePaths() {
  return Array.from(PAGES_BY_URI.values())
    .map((p) => slugParamFromUri(p.uri))
    .filter((s) => s.length > 0) // don’t emit root here (index handles "/")
    .map((s) => ({ params: { slug: s } })); // <-- string param for [...slug] / [[...slug]]
}

// ---- service taxonomy
export function getFlexibleServiceTermBySlug(slug) {
  return SERVICE_TERMS.find((t) => t.slug === slug) || null;
}

export function getAllServiceTermPaths() {
  return SERVICE_TERMS.map((t) => ({ params: { slug: t.slug } }));
}

// ---- service-area taxonomy
export function getFlexibleServiceAreaTermBySlug(slug) {
  return SERVICE_AREA_TERMS.find((t) => t.slug === slug) || null;
}

export function getAllServiceAreaTermPaths() {
  return SERVICE_AREA_TERMS.map((t) => ({ params: { slug: t.slug } }));
}
