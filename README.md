# Δ Truth Engine — delta.genesisconductor.io

Live RTPTPA (Relative-Tensor Power-Tower Arbitration) verification API **plus** the
Canva-authored Δ Truth Engine front-end, served from a single Cloudflare Pages
deployment on `delta.genesisconductor.io`.

> Core principle: **"Truth is Structural"** — relative tensors `R = (B − O)/(O + ε)`, never absolute positions.

## What runs where

```
delta.genesisconductor.io  (Cloudflare Pages: delta-truth-engine, advanced _worker.js)
├── /api/*   → RTPTPA engine  ── D1 (delta-truth-ledger)  persistent anchor ledger
│                              └─ KV (DELTA_CACHE)         deterministic verify cache
└── /*       → hardened reverse-proxy → https://deltatruth.my.canva.site  (the design)
```

### Why a proxy for the UI
Canva-published sites embed a **per-request encrypted bootstrap token** and render via
Canva's backend, so a static mirror white-screens once the token goes stale. We proxy
live so the token stays fresh, and inject `data-cfasync="false"` on every `<script>` via
`HTMLRewriter` so zone-wide **Rocket Loader** can't re-order/mangle the SPA's scripts.
Immutable assets (`/_assets/*`, `*.js|css|woff2|png…`) are edge-cached for 24h.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness + D1/KV binding status |
| GET | `/api/status` | Chain head, anchored total, crystal/spectral scores, tier colors |
| GET\|POST | `/api/verify` | Verify a claim. `?claim=…` or `POST {"claim":"…"}`. Deterministic; KV-cached 5 min. |
| POST | `/api/anchor` | **Server re-verifies** then commits to the D1 ledger (monotonic block + SHA hash). |
| GET | `/api/ledger?limit=N` | Most-recent anchors (default 20, max 100). |

`verify` returns: `div`, `tier` (aligned\|tension\|divergent), `tension`, `consensus`,
`confidence`, per-oracle `oracle_divs`, `belief_preview`, `evt_id`.

Anchors are forgery-resistant: `/api/anchor` ignores any client-supplied scores and
re-runs the engine on the claim before writing.

## RTPTPA engine

`src/engine.js` is a faithful, **bit-for-bit** port of the reference Python engine
(`engine/delta_truth_engine.py`): same `hash01`, belief/oracle tensors, relative tensor,
power-tower weighting, antagonistic fusion, tier thresholds. Parity is frozen as golden
values in `test/engine.test.js`.

```bash
npm test            # node --test: unit + Python-parity golden values
python3 engine/delta_truth_engine.py   # reference CLI
```

## Develop & deploy

```bash
npm install
npm run build                 # assemble public/_worker.js/ from src/
npm test                      # parity + unit tests
npm run migrate:remote        # apply D1 migrations
npm run deploy                # build + wrangler pages deploy
# production branch:
npx wrangler pages deploy --branch main
```

### Bindings (`wrangler.jsonc`)
- **D1** `DB` → `delta-truth-ledger`
- **KV** `DELTA_CACHE`
- Observability enabled (use `npx wrangler pages deployment tail` to watch live traffic).

## Layout

```
src/engine.js        canonical RTPTPA math (tested)
src/worker.js        fetch handler: /api/* + reverse-proxy
build.mjs            assembles public/_worker.js/{index.js,engine.js}
migrations/          D1 schema (anchors, chain_state)
test/                node --test parity + unit tests
engine/…py           reference Python engine
```

## Roadmap
- Calibrate tier thresholds (current corpus skews ALIGNED).
- Wire the front-end's verify/anchor buttons to `/api/*` (replace Canva's client-side sim).
- Optional: real oracle ingestion (ArXiv / X / Grokpedia) behind the oracle tensors.
