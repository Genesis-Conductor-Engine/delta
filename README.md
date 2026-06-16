# Δ Truth Engine

Multi-oracle claim-verification and divergence-ledger UI for **delta.genesisconductor.io**, part of the Genesis Conductor ecosystem.

A self-contained, single-file React application: submit a claim, watch the oracle network (ArXiv, X_API, Grokpedia) scan it, and get a divergence reading anchored to the on-chain ledger. Views: **Console · Verify · Tensor · Ledger · Oracles** (⌘K / Ctrl-K command palette).

## Architecture

`index.html` is fully self-contained — no build step required:

- **React 18** + **ReactDOM** loaded from unpkg (UMD).
- **`@babel/standalone`** transpiles the in-browser `<script type="text/babel">` block at load time.
- All styling is inline (`<style>` + a few CSS classes); fonts are Inter / Inter Tight / JetBrains Mono via Google Fonts.

## ⚠️ Cloudflare Rocket Loader — critical deployment note

Every `<script>` tag carries **`data-cfasync="false"`**. This is **required**, not cosmetic.

Cloudflare **Rocket Loader** rewrites and defers `<script>` tags (changing their `type` to an
internal `<hash>-text/javascript` marker and loading them async). That breaks this app: the
`text/babel` block depends on `@babel/standalone` having scanned the DOM synchronously at load.
With Rocket Loader interfering, the JSX never transpiles, React never mounts into `<div id="root">`,
and the page renders as a **blank deep-blue screen** (the app's `#0a0d12` background).

`data-cfasync="false"` is Cloudflare's documented opt-out: Rocket Loader skips any script marked
with it. With these markers in place the app renders correctly **regardless of the zone's Rocket
Loader setting** — no dashboard change required.

If you ever add a new `<script>` tag, it **must** include `data-cfasync="false"`.

## Local preview

```bash
# any static server works; the app needs no build
python3 -m http.server 8099
# → open http://localhost:8099/
```

## Deploy (Cloudflare Pages)

Static site, no build command, output directory = repo root.

```bash
npx wrangler pages deploy . --project-name=delta
```

Then bind the custom domain `delta.genesisconductor.io` to the Pages project.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire application (self-contained). |
| `_headers` | Cloudflare Pages cache/security headers. |
| `LICENSE` | License. |
