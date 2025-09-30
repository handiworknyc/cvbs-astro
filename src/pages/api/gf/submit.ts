// src/pages/api/gf/submit.ts
// ✅ Astro v5 API route. Must live under src/pages/api/... to route to /api/...
// IMPORTANT: restart the dev server after adding/changing routes.

export const prerender = false; // ensure it's handled at runtime in dev/SSR

const TAG = "[/api/gf/submit]";

const WP_BASE =
  (import.meta.env.WP_BASE_URL as string | undefined) ||
  (import.meta.env.PUBLIC_WP_BASE_URL as string | undefined) ||
  "";

if (!WP_BASE) {
  console.warn(TAG, "Missing WP_BASE_URL / PUBLIC_WP_BASE_URL env var!");
}

export async function GET() {
  // Handy probe: visiting /api/gf/submit in the browser should show 405 JSON, not your 404 HTML.
  return new Response(JSON.stringify({ ok: false, message: "Use POST" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const base = WP_BASE.replace(/\/+$/, "");
    const wpUrl = `${base}/wp-json/astro/v1/gf/submit`;

    console.log(TAG, reqId, "incoming POST");
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      console.error(TAG, reqId, "bad JSON body:", e);
      return new Response(JSON.stringify({ ok: false, message: "Bad JSON" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    console.log(TAG, reqId, "proxy →", wpUrl, "body keys:", Object.keys(body || {}));

    const upstream = await fetch(wpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // body is: { formId, payload }
      body: JSON.stringify(body),
      credentials: "include",
    });

    const text = await upstream.text();
    const ct = upstream.headers.get("content-type") || "";

    // console.log(
    //   TAG,
    //   reqId,
    //   "← upstream",
    //   upstream.status,
    //   ct.split(";")[0],
    //   "first200:",
    //   text.slice(0, 200)
    // );

    // Pass through upstream status & body
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": ct || "application/json",
        "x-gf-proxy": "astro",
      },
    });
  } catch (e: any) {
    console.error(TAG, "proxy error:", e?.stack || e);
    return new Response(JSON.stringify({ ok: false, message: "Proxy error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
