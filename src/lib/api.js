import { fetchAPI } from "./wp.js";

/* ================================
 * GraphQL-based helpers (yours)
 * ================================ */

// ../lib/api.ts
export async function navQuery(){
  const res = await fetch(import.meta.env.WORDPRESS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      query: `{
        menus(where: {location: PRIMARY}) {
          nodes {
            name
            menuItems(first: 200) {
              nodes {
                id
                databaseId
                parentId
                parentDatabaseId
                parent { node { id databaseId } }
                label
                uri
                url
                cssClasses
                target
                title
                xfn
                order
              }
            }
          }
        }
        generalSettings { title url description }
      }`
    })
  });

  const { data } = await res.json();
  // Ensure the shape is ALWAYS present
  return {
    menus: data?.menus ?? { nodes: [] },
    generalSettings: data?.generalSettings ?? { title: '', url: '', description: '' },
  };
}

export async function homePagePostsQuery(){
  const response = await fetch(import.meta.env.WORDPRESS_API_URL, {
    method: 'post',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      query: `{
        posts {
          nodes {
            date
            uri
            title
            commentCount
            excerpt
            categories {
              nodes {
                name
                uri
              }
            }
            featuredImage {
              node {
                srcSet
                sourceUrl
                altText
                mediaDetails { height width }
              }
            }
          }
        }
      }`
    })
  });
  const { data } = await response.json();
  return data;
}

// Fetch recent Projects for home
export async function homePagePortfolioQuery() {
  return fetchAPI(`
    query HomeProjects($first: Int = 12) {
      posts: projects(first: $first, where: { orderby: { field: DATE, order: DESC } }) {
        nodes { uri title }
      }
    }
  `);
}

// Resolve any URI to a WP node (now handling Project instead of Portfolio)
export async function getNodeByURI(uri) {
  const response = await fetch(import.meta.env.WORDPRESS_API_URL, {
    method: "post",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
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
      `,
      variables: { uri },
    }),
  });
  const { data } = await response.json();
  return data;
}

// Collect all URIs, now including Projects instead of allPortfolio
export async function getAllUris() {
  const response = await fetch(import.meta.env.WORDPRESS_API_URL, {
    method: "post",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetAllUris {
        terms { nodes { uri } }
        posts(first: 100) { nodes { uri } }
        pages(first: 100) { nodes { uri } }
        projects(first: 100) { nodes { uri } }
      }`,
    }),
  });

  const { data } = await response.json();

  const allNodes = Object.values(data).reduce((acc, group) => {
    if (group?.nodes) acc = acc.concat(group.nodes);
    return acc;
  }, []);

  const uris = allNodes
    .filter((node) => node.uri)
    .map((node) => {
      const trimmed = node.uri.replace(/^\/|\/$/g, "");
      return { params: { uri: trimmed } };
    });

  console.log("Static paths:", uris);
  return uris;
}

/* ===========================================
 * Flexible-content (file-based) helpers (NEW)
 * =========================================== */

// Eagerly import JSON written by your sync script
const pageMods = import.meta.glob('/src/content/wp/pages/*.json', { eager: true });
const serviceMods = import.meta.glob('/src/content/wp/tax/service/*.json', { eager: true });
const serviceAreaMods = import.meta.glob('/src/content/wp/tax/service-area/*.json', { eager: true });

// Utilities
function normalizeUri(u) {
  let s = (u || '/').trim();
  if (!s.startsWith('/')) s = '/' + s;
  if (!s.endsWith('/')) s += '/';
  return s;
}

function slugifyUri(uri) {
  const trimmed = (uri || '').replace(/^\/|\/$/g, '');
  return trimmed ? trimmed.split('/') : [];
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
const SERVICE_TERMS = listFromMods(serviceMods);           // { kind:'term', taxonomy:'service', slug, title?, layouts[] }
const SERVICE_AREA_TERMS = listFromMods(serviceAreaMods);  // { kind:'term', taxonomy:'service-area', slug, title?, layouts[] }

// ---- Pages
export function getFlexiblePageByUri(uri) {
  return PAGES_BY_URI.get(normalizeUri(uri)) || null;
}

export function getAllFlexiblePagePaths() {
  return Array.from(PAGES_BY_URI.values()).map((p) => ({
    params: { slug: slugifyUri(p.uri) }
  }));
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
