// Reverse-proxy delta.genesisconductor.io -> the live Canva-published site.
// Canva sites embed a per-request encrypted bootstrap token and render via Canva's
// backend, so a static mirror white-screens. Proxying live keeps tokens fresh.
//
// We also inject data-cfasync="false" onto every <script> via HTMLRewriter so that
// Cloudflare Rocket Loader (on zone-wide) leaves the SPA's scripts alone — otherwise
// RL rewrites their type/loading order and the app never boots (blank/white page).
const ORIGIN = "https://deltatruth.my.canva.site";

class CfAsyncOff {
  element(el) {
    el.setAttribute("data-cfasync", "false");
  }
}

export default {
  async fetch(request) {
    const inUrl = new URL(request.url);
    const target = ORIGIN + inUrl.pathname + inUrl.search;

    const h = new Headers(request.headers);
    h.delete("host");
    h.delete("cf-connecting-ip");
    h.delete("cf-ipcountry");
    h.delete("x-forwarded-host");
    h.delete("x-forwarded-proto");
    h.delete("accept-encoding"); // let the platform handle encoding

    const upstream = await fetch(target, {
      method: request.method,
      headers: h,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    const respHeaders = new Headers(upstream.headers);
    respHeaders.delete("content-security-policy-report-only");
    respHeaders.delete("content-encoding");
    respHeaders.delete("content-length");

    const resp = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });

    const ct = upstream.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      return new HTMLRewriter().on("script", new CfAsyncOff()).transform(resp);
    }
    return resp;
  },
};
