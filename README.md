# Δ Truth Engine — delta.genesisconductor.io

Serves the team's **Delta Truth Engine** design (authored in Canva, published at
`deltatruth.my.canva.site`) at `delta.genesisconductor.io`, via a Cloudflare Pages
reverse-proxy worker.

## Why a proxy instead of a static mirror

Canva-published sites **cannot be statically rehosted**. Each page response embeds
`window['__canva_website_bootstrap__']` — an encrypted (JWE) token Canva regenerates per
request and the app hands back to Canva's backend to render. A frozen static copy serves a
stale token, the app fails to initialize, and you get a **white page**.

`_worker.js` reverse-proxies every request to the live Canva origin, so the token is always
fresh and the page renders exactly as on `deltatruth.my.canva.site` — under our own domain.

## Cloudflare Rocket Loader

Rocket Loader is enabled zone-wide on `genesisconductor.io`. It rewrites/defers `<script>`
tags, which breaks the Canva SPA (scripts never run -> blank/white page). The worker uses
`HTMLRewriter` to add `data-cfasync="false"` to every `<script>` on the fly (Cloudflare's
documented opt-out), so Rocket Loader leaves them alone. This does not affect the scripts'
Subresource Integrity (SRI covers file content, not tag attributes) or nonces.

## Deploy

```bash
npx wrangler pages deploy . --project-name=delta-truth-engine --branch=main
```

`delta.genesisconductor.io` is bound as a custom domain on the `delta-truth-engine`
Cloudflare Pages project. When a `_worker.js` is present, Pages serves it for all routes.

## Updating the design

Edit the design in Canva and re-publish — no redeploy needed here, the worker always proxies
the latest live version.
