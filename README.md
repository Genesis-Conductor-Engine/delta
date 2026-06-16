# Δ Truth Engine — delta.genesisconductor.io

Static mirror of the **Delta Truth Engine** site (authored in Canva, published at
`deltatruth.my.canva.site`), deployed to Cloudflare Pages and served at
`delta.genesisconductor.io`.

## Contents

- `index.html` — page markup (Canva export).
- `_assets/` — JS bundles, CSS, fonts (woff/woff2), and images. Filenames are content-hashed and immutable.
- `_headers` — Cloudflare Pages cache/security headers (immutable `_assets`, revalidate HTML).

## ⚠️ Two Cloudflare gotchas (both already handled)

1. **Rocket Loader** — every `<script>` tag carries `data-cfasync="false"` so Rocket Loader
   leaves them alone. Without it, Rocket Loader defers/reorders the bundles and the SPA never
   boots (blank screen). This is harmless to the SRI hashes (integrity covers file *content*,
   not tag attributes). **Any new `<script>` must include `data-cfasync="false"`.**
2. **Auto Minify must stay OFF** for this zone — the scripts use Subresource Integrity
   (`integrity="sha512-…"`). If Cloudflare rewrites JS/CSS bytes, the hashes no longer match
   and the browser blocks the scripts → blank page. Verified at deploy time that live-served
   bytes match the SRI hashes.

## Re-deploy

The site is static; re-mirror from Canva and deploy:

```bash
npx wrangler pages deploy . --project-name=delta-truth-engine --branch=main
```

`delta.genesisconductor.io` is bound as a custom domain on the `delta-truth-engine` Pages project.

## Updating from Canva

When the Canva design changes, re-export/re-mirror `index.html` + `_assets/`, re-apply
`data-cfasync="false"` to all `<script>` tags, then deploy. Confirm SRI still matches the
live-served bytes after deploy.
