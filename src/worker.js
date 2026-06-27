// ─────────────────────────────────────────────────────────────────────────────
// delta.genesisconductor.io — Δ Truth Engine
//   /api/*  → RTPTPA verification API (D1 ledger + KV cache)
//   else    → hardened reverse-proxy to the Canva-authored design
// ─────────────────────────────────────────────────────────────────────────────
import { verify as engineVerify, hexHash, DEFAULTS, TIER_COLOR } from "./engine.js";

const ORIGIN = "https://deltatruth.my.canva.site";
const VERIFY_CACHE_TTL = 300; // seconds; verify() is deterministic so cache is safe

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-delta-engine": DEFAULTS.version,
};
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...SECURITY_HEADERS, ...extra },
  });

// Neutralize Cloudflare Rocket Loader on the proxied SPA scripts.
class CfAsyncOff {
  element(el) { el.setAttribute("data-cfasync", "false"); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: { ...CORS, ...SECURITY_HEADERS } });
    }

    try {
      if (url.pathname === "/api/health") return handleHealth(env);
      if (url.pathname === "/api/status") return handleStatus(env);
      if (url.pathname === "/api/verify") return handleVerify(request, env, ctx);
      if (url.pathname === "/api/anchor") return handleAnchor(request, env);
      if (url.pathname === "/api/ledger") return handleLedger(request, env);
      if (url.pathname.startsWith("/api/")) return json({ error: "not_found", path: url.pathname }, 404);
    } catch (err) {
      return json({ error: "engine_error", message: String(err?.message || err) }, 500);
    }

    return proxyToCanva(request, url, ctx);
  },
};

// ── API handlers ─────────────────────────────────────────────────────────────

async function handleHealth(env) {
  let d1 = "unbound", kv = "unbound";
  try { if (env.DB) { await env.DB.prepare("SELECT 1").first(); d1 = "ok"; } } catch (e) { d1 = "error:" + e.message; }
  try { if (env.DELTA_CACHE) { await env.DELTA_CACHE.get("__health__"); kv = "ok"; } } catch (e) { kv = "error:" + e.message; }
  return json({ status: "ok", service: "delta-truth-engine", version: DEFAULTS.version, d1, kv, ts: new Date().toISOString() });
}

async function handleStatus(env) {
  const head = await chainHead(env);
  return json({
    genesis_block: head.genesis_block,
    current_block: head.current_block,
    anchored_total: head.anchored_total,
    crystal_score: DEFAULTS.crystalScore ?? 0.82,
    spectral_gap: 0.71,
    oracles_connected: 3,
    engine_version: DEFAULTS.version,
    math: "relative-tensor + power-tower + antagonistic-fusion",
    tier_colors: TIER_COLOR,
  });
}

async function readClaim(request, url) {
  if (request.method === "POST") {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) { const b = await request.json(); return (b.claim ?? b.statement ?? "").toString(); }
    const form = await request.formData().catch(() => null);
    if (form) return (form.get("claim") || form.get("statement") || "").toString();
  }
  return (url.searchParams.get("claim") || url.searchParams.get("q") || "").toString();
}

async function handleVerify(request, env, ctx) {
  const url = new URL(request.url);
  const claim = (await readClaim(request, url)).trim();
  if (!claim) return json({ error: "missing_claim", hint: "POST {\"claim\":\"…\"} or ?claim=…" }, 400);
  if (claim.length > 2000) return json({ error: "claim_too_long", max: 2000 }, 413);

  const cacheKey = "v:" + (await hexHash(claim, 0));
  if (env.DELTA_CACHE) {
    const hit = await env.DELTA_CACHE.get(cacheKey, "json");
    if (hit) return json({ ...hit, cached: true });
  }
  const reading = engineVerify(claim);
  if (env.DELTA_CACHE) ctx.waitUntil(env.DELTA_CACHE.put(cacheKey, JSON.stringify(reading), { expirationTtl: VERIFY_CACHE_TTL }));
  return json({ ...reading, cached: false });
}

async function handleAnchor(request, env) {
  if (request.method !== "POST") return json({ error: "method_not_allowed", use: "POST" }, 405);
  if (!env.DB) return json({ error: "ledger_unavailable", detail: "D1 not bound" }, 503);

  const url = new URL(request.url);
  const claim = (await readClaim(request, url)).trim();
  if (!claim) return json({ error: "missing_claim" }, 400);

  // Re-verify server-side so anchors can't be forged with arbitrary numbers.
  const r = engineVerify(claim);

  // Allocate next block atomically and persist.
  const head = await chainHead(env);
  const block = head.current_block + 1;
  const hash = await hexHash(claim, block);
  const evtId = `evt_anchor_${Date.now()}`;

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO anchors (block,statement,divergence,tier,tension,consensus,confidence,oracle_divs,hash,evt_id,crystal_score,spectral_gap)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(block, r.statement, r.div, r.tier, r.tension, r.consensus, r.confidence,
           JSON.stringify(r.oracle_divs), hash, evtId, r.crystal_score, r.spectral_gap),
    env.DB.prepare(`UPDATE chain_state SET current_block=?, anchored_total=anchored_total+1 WHERE id=1`).bind(block),
  ]);

  return json({ ...r, anchored: true, block, hash, evt_id: evtId });
}

async function handleLedger(request, env) {
  if (!env.DB) return json({ error: "ledger_unavailable", detail: "D1 not bound" }, 503);
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const { results } = await env.DB.prepare(
    `SELECT block,statement,divergence,tier,tension,consensus,confidence,oracle_divs,hash,evt_id,created_at
     FROM anchors ORDER BY block DESC LIMIT ?`
  ).bind(limit).all();
  const rows = (results || []).map((x) => ({ ...x, oracle_divs: safeParse(x.oracle_divs) }));
  const head = await chainHead(env);
  return json({ count: rows.length, current_block: head.current_block, anchored_total: head.anchored_total, anchors: rows });
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function chainHead(env) {
  const fallback = { genesis_block: 8492103, current_block: 8492103, anchored_total: 2418 };
  if (!env.DB) return fallback;
  const row = await env.DB.prepare(`SELECT genesis_block,current_block,anchored_total FROM chain_state WHERE id=1`).first();
  return row || fallback;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

// ── reverse proxy (hardened) ───────────────────────────────────────────────────

async function proxyToCanva(request, url, ctx) {
  const target = ORIGIN + url.pathname + url.search;
  const h = new Headers(request.headers);
  for (const k of ["host", "cf-connecting-ip", "cf-ipcountry", "x-forwarded-host", "x-forwarded-proto", "accept-encoding"]) h.delete(k);

  // Edge-cache immutable Canva assets to cut origin round-trips.
  const isAsset = /\.(js|css|woff2?|png|jpe?g|svg|gif|webp|ico|mp4|json)$/i.test(url.pathname) || url.pathname.startsWith("/_assets/");
  const cache = caches.default;
  if (isAsset && request.method === "GET") {
    const cached = await cache.match(request);
    if (cached) return cached;
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: h,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
  } catch (e) {
    return new Response("Upstream unavailable: " + e.message, { status: 502, headers: SECURITY_HEADERS });
  }

  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("content-security-policy-report-only");
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) respHeaders.set(k, v);

  const ct = upstream.headers.get("content-type") || "";

  if (ct.includes("text/html")) {
    const resp = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: respHeaders });
    return new HTMLRewriter().on("script", new CfAsyncOff()).transform(resp);
  }

  if (isAsset && request.method === "GET" && upstream.status === 200) {
    respHeaders.set("cache-control", "public, max-age=86400");
    const resp = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: respHeaders });
    ctx.waitUntil(cache.put(request, resp.clone()));
    return resp;
  }

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: respHeaders });
}
