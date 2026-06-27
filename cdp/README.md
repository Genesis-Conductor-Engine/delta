# Δ Truth × Coinbase CDP — on-chain anchor relayer

Anchors Δ Truth Engine verifications onto **Base** using a Coinbase **CDP API-key
(non-custodial) wallet** — backend-controlled, no browser SDK, no end-user sign-in.
Wallet spending is governed by a CDP **Policy Engine** rule (≤ 0.02 ETH/tx, destination allowlist).

## Flow
```
claim ──► delta.genesisconductor.io/api/anchor    (verify + D1 anchor: block, hash)
      ──► CDP Policy Engine: check spend ≤ 0.02 ETH + allowlist
      ──► CDP wallet sends real tx on Base          (calldata = "Δ#<block> <hash> …")
      ──► /api/anchor/onchain (relay-key auth)      links tx into D1 ledger
      ──► live panel widget shows BaseScan link
```

## Quick setup (do NOT paste secrets into chat)

### Option A — CDP CLI (fastest validation)
```bash
npm install -g @coinbase/cdp-sdk        # or @coinbase/coinbase-cli for Advanced Trade
cdp env live --key-file ./cdp_api_key.json
cdp env live --wallet-secret-file ./cdp_wallet_secret.txt
cdp evm accounts create name=delta-truth-anchor
```

### Option B — SDK (this repo)
1. **CDP Portal** → [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. **Secret API key** → [/api-keys/secret](https://portal.cdp.coinbase.com/api-keys/secret)
   - Advanced settings: ✅ **Non-custodial: Export** + **Non-custodial: Manage** (for Policy Engine)
   - Signature algorithm: **Ed25519** (keep default)
   - Download JSON → `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`
3. **Wallet Secret** → [/wallets/non-custodial/security](https://portal.cdp.coinbase.com/wallets/non-custodial/security)
   - Click **Generate Wallet Secret** (shown once) → `CDP_WALLET_SECRET`
4. Fill `cdp/.env` (pre-created at `0600`, gitignored):
   ```
   CDP_API_KEY_ID=<key-id>
   CDP_API_KEY_SECRET=<private-key>
   CDP_WALLET_SECRET=<wallet-secret>
   ```
   The `DELTA_API_BASE`, `ANCHOR_RELAY_KEY`, `DELTA_NETWORK` lines are pre-filled.

### One operator step — register the relay key with the Worker
```bash
cd ~/delta
grep '^ANCHOR_RELAY_KEY=' cdp/.env | cut -d= -f2- \
  | npx wrangler pages secret put ANCHOR_RELAY_KEY --project-name delta-truth-engine
```

## Run
```bash
cd ~/delta/cdp
npm install
npm run quickstart       # SDK sanity check: create wallet → faucet → send
npm run anchor -- "A Mediterranean diet extends median lifespan"   # full Δ→chain→ledger
```

## Policy Engine (agentic safety)
`anchor.ts` automatically creates an account-level spend policy on first run:
- **Max ETH/tx: 0.02 ETH** — matches the Aerodrome LP per-tx cap in `caps.json`
- **Destination allowlist**: self-address (testnet) + pool + router (mainnet)
- Requires `Non-custodial: Manage` key scope. Gracefully skips if scope is missing.

Policy creation: `cdp.policies.createPolicy()` → `cdp.evm.updateAccount({ accountPolicy: policy.id })`.
See live docs: [portal.cdp.coinbase.com/wallets/non-custodial/security](https://portal.cdp.coinbase.com/wallets/non-custodial/security)

## Registered MCPs (Claude Code)
```
coinbase-cdp      → https://docs.cdp.coinbase.com/mcp       (HTTP)  ✅ live docs
coinbase          → coinbase mcp (stdio)                     ✅ Advanced Trade (needs key)
coinbase-payments → npx @coinbase/payments-mcp (stdio)       beta
```

To query live CDP docs in any session:
```
search: search_coinbase_developer query="getOrCreateAccount"
fs:     query_docs_filesystem_coinbase_developer command="head -100 /wallets/quickstart/api-key-auth.mdx"
```

## Go to mainnet
Set `DELTA_NETWORK=base` in `cdp/.env`. Fund the `delta-truth-anchor` wallet with real ETH
(the relayer prints its address on first run). Faucet step is auto-skipped on mainnet.

## Wallet info
- Named account: `delta-truth-anchor` (stable across runs via `getOrCreateAccount`)
- Network: `base-sepolia` (testnet) or `base` (mainnet) — set via `DELTA_NETWORK`
- Keys secured in Coinbase's Trusted Execution Environment (no key ever touches disk)
