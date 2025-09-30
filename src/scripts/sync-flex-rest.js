import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const WP_BASE = process.env.WP_BASE_URL;
if (!WP_BASE) throw new Error("Missing WP_BASE_URL (e.g. https://clbr.local)");

const GRAPHQL = process.env.WORDPRESS_API_URL || process.env.WP_GRAPHQL_URL || "";
const PAGE_URIS_ENV = (process.env.PAGE_URIS || "").trim();
const AUTH = process.env.WP_AUTH_BASIC
  ? "Basic " + Buffer.from(process.env.WP_AUTH_BASIC).toString("base64")
  : null;

function authHeaders() { return AUTH ? { Authorization: AUTH } : {}; }

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${url}\n${text.slice(0, 400)}`);
  }
  return { json: await res.json(), res };
}

function toPathname(link) {
  try {
    const u = new URL(link);
    let p = u.pathname;
    if (!p.endsWith("/")) p += "/";
    if (!p.startsWith("/")) p = "/" + p;
    return p;
  } catch { return "/"; }
}

function fileSlugFromUri(uri) {
  return uri.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "_") || "home";
}

async function discoverPagesViaREST() {
  // Only "pages"
  const pages = [];
  let page = 1;
  while (true) {
    const url = new URL("/wp-json/wp/v2/pages", WP_BASE);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const { json, res } = await fetchJSON(url);
    if (!Array.isArray(json) || !json.length) break;
    pages.push(...json.map(p => toPathname(p.link)));
    const totalPages = Number(res.headers.get("X-WP-TotalPages") || "1");
    if (page >= totalPages) break;
    page++;
  }
  return Array.from(new Set(pages));
}

async function discoverTermsViaREST(taxonomy) {
  // e.g. service, service-area
  const out = [];
  let page = 1;
  while (true) {
    const url = new URL(`/wp-json/wp/v2/${taxonomy}`, WP_BASE);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const { json, res } = await fetchJSON(url);
    if (!Array.isArray(json) || !json.length) break;
    for (const t of json) {
      out.push({ taxonomy, slug: t.slug, link: t.link ? toPathname(t.link) : null });
    }
    const totalPages = Number(res.headers.get("X-WP-TotalPages") || "1");
    if (page >= totalPages) break;
    page++;
  }
  return out;
}


async function discoverViaGraphQL() {
  if (!GRAPHQL) return { pageUris: [], terms: [] };

  // Allow overrides if your enums are e.g. SERVICE_AREA instead of SERVICEAREA
  const TAX_ENUM_SERVICE = (process.env.TAX_ENUM_SERVICE || "SERVICE").trim();
  const TAX_ENUM_SERVICE_AREA = (process.env.TAX_ENUM_SERVICE_AREA || "SERVICEAREA").trim();

  // Build the query string with the enum tokens inlined (GraphQL enums can't be variables)
  const q = /* GraphQL */ `
    query URIs {
      pages(first: 500, where: { status: PUBLISH }) { nodes { uri } }
      service: terms(first: 500, where: { taxonomies: [${TAX_ENUM_SERVICE}], hideEmpty: false }) { nodes { slug } }
      serviceArea: terms(first: 500, where: { taxonomies: [${TAX_ENUM_SERVICE_AREA}], hideEmpty: false }) { nodes { slug } }
    }
  `;

  try {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ query: q }),
    });
    if (!res.ok) return { pageUris: [], terms: [] };
    const json = await res.json().catch(() => ({}));

    const pageUris = (json?.data?.pages?.nodes || []).map(n => n?.uri).filter(Boolean);
    const terms = [
      ...(json?.data?.service?.nodes || []).map(n => ({ taxonomy: "service", slug: n.slug })),
      ...(json?.data?.serviceArea?.nodes || []).map(n => ({ taxonomy: "service-area", slug: n.slug })),
    ];
    return { pageUris: Array.from(new Set(pageUris)), terms };
  } catch {
    return { pageUris: [], terms: [] };
  }
}


async function fetchFlexibleForPage(uri) {
  const url = new URL("/wp-json/astro/v1/flexible", WP_BASE);
  url.searchParams.set("uri", uri);
  // use formatted values (images as arrays). Add "&format=raw" if you prefer raw IDs.
  const { json } = await fetchJSON(url);
  return json;
}

async function fetchFlexibleForTerm(taxonomy, slug) {
  const url = new URL("/wp-json/astro/v1/flexible", WP_BASE);
  url.searchParams.set("taxonomy", taxonomy);
  url.searchParams.set("term", slug);
  const { json } = await fetchJSON(url);
  return json;
}

async function run() {
  console.log("ENV:", { WP_BASE_URL: WP_BASE, WORDPRESS_API_URL: GRAPHQL || "(none)" });

  const outBase = path.join(process.cwd(), "src", "content", "wp");
  const outPages = path.join(outBase, "pages");
  const outTaxService = path.join(outBase, "tax", "service");
  const outTaxServiceArea = path.join(outBase, "tax", "service-area");
  [outPages, outTaxService, outTaxServiceArea].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

  // 1) gather targets
  let pageUris =
    PAGE_URIS_ENV ? PAGE_URIS_ENV.split(",").map(s => s.trim()).filter(Boolean)
                  : await discoverPagesViaREST().catch(() => []);
  let termsService = await discoverTermsViaREST("service").catch(() => []);
  let termsServiceArea = await discoverTermsViaREST("service-area").catch(() => []);

  if (!pageUris.length || (!termsService.length && !termsServiceArea.length)) {
    const fb = await discoverViaGraphQL();
    if (!pageUris.length) pageUris = fb.pageUris;
    if (!termsService.length && !termsServiceArea.length) {
      termsService = fb.terms.filter(t => t.taxonomy === "service");
      termsServiceArea = fb.terms.filter(t => t.taxonomy === "service-area");
    }
  }

  console.log(`🔎 Pages: ${pageUris.length}, service terms: ${termsService.length}, service-area terms: ${termsServiceArea.length}`);
  if (!pageUris.length && !termsService.length && !termsServiceArea.length) {
    console.warn("⚠️  Nothing discovered. Check that REST/GraphQL are reachable and taxonomies exist.");
    return;
  }

  // 2) fetch & write
  let wrote = 0, skipped = 0, failed = 0;

  // Pages
  for (const uri of pageUris) {
    try {
      const data = await fetchFlexibleForPage(uri);
      const layouts = Array.isArray(data?.layouts) ? data.layouts : [];
      if (!layouts.length) { console.log(`🔎 Skip page (no layouts): ${uri}`); skipped++; continue; }
      const file = path.join(outPages, `${fileSlugFromUri(uri)}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      console.log(`✅ Wrote ${file} (${layouts.length} layouts)`);
      wrote++;
    } catch (e) {
      console.error(`❌ Page ${uri}:`, e.message || e);
      failed++;
    }
  }

  // service terms
  for (const t of termsService) {
    try {
      const data = await fetchFlexibleForTerm("service", t.slug);
      const layouts = Array.isArray(data?.layouts) ? data.layouts : [];
      if (!layouts.length) { console.log(`🔎 Skip term service:${t.slug} (no layouts)`); skipped++; continue; }
      const file = path.join(outTaxService, `${t.slug}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      console.log(`✅ Wrote ${file} (${layouts.length} layouts)`);
      wrote++;
    } catch (e) {
      console.error(`❌ Term service:${t.slug}:`, e.message || e);
      failed++;
    }
  }

  // service-area terms
  for (const t of termsServiceArea) {
    try {
      const data = await fetchFlexibleForTerm("service-area", t.slug);
      const layouts = Array.isArray(data?.layouts) ? data.layouts : [];
      if (!layouts.length) { console.log(`🔎 Skip term service-area:${t.slug} (no layouts)`); skipped++; continue; }
      const file = path.join(outTaxServiceArea, `${t.slug}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      console.log(`✅ Wrote ${file} (${layouts.length} layouts)`);
      wrote++;
    } catch (e) {
      console.error(`❌ Term service-area:${t.slug}:`, e.message || e);
      failed++;
    }
  }

  console.log("---------------------------------------------------");
  console.log(`Sync complete: wrote=${wrote}, skipped(no layouts)=${skipped}, failed=${failed}`);
  console.log(`Output dirs: ${outPages}, ${outTaxService}, ${outTaxServiceArea}`);
  console.log("---------------------------------------------------");
}

run().catch((e) => {
  console.error("🔥 Sync script crashed:", e);
  process.exit(1);
});
