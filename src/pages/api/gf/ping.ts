// src/pages/api/ping.ts
import type { APIRoute } from "astro";

export const prerender = false; // make it run in dev / SSR, not prerendered

export const GET: APIRoute = async () => {
  console.log("[/api/ping] HIT");
  return new Response(JSON.stringify({ ok: true, route: "/api/ping" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
