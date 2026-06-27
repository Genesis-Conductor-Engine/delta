# Δ Truth × Coinbase CDP — on-chain anchor relayer

Anchors Δ Truth Engine verifications onto **Base** using a Coinbase **CDP API-key
(non-custodial) wallet** — backend-controlled, no browser SDK, no end-user sign-in.

## Flow
```
claim ──► delta.genesisconductor.io/api/anchor  (verify + D1 anchor: block, hash)
      ──► CDP wallet sends real tx on Base  (calldata = "Δ#<block> <hash> …")
      ──► /api/anchor/onchain (relay-key auth) links the tx hash into the D1 ledger
      ──► widget on delta.genesisconductor.io shows the BaseScan link
```

## Setup (do NOT paste secrets into chat)
1. **CDP Portal**: portal.cdp.coinbase.com → create account, verify email.
2. **Secret API key**: portal.cdp.coinbase.com/api-keys/secret → create a Secret API Key.
   Advanced settings: check **Non-custodial: Export** + **Non-custodial: Manage**, keep
   **Ed25519**. Download the JSON. → `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`.
3. **Wallet secret**: portal.cdp.coinbase.com/wallets/non-custodial/security →
   **Generate Wallet Secret** (shown once). → `CDP_WALLET_SECRET`.
4. Put those three into `cdp/.env` (already created, gitignored, mode 0600). The
   `DELTA_API_BASE`, `ANCHOR_RELAY_KEY`, `DELTA_NETWORK` lines are pre-filled.

### One operator step — register the relay key with the Worker
The relayer authenticates its ledger-link callback with `ANCHOR_RELAY_KEY`. Set the
matching Cloudflare Pages secret (value is read straight from `cdp/.env`, never printed):
```bash
cd ~/delta
grep '^ANCHOR_RELAY_KEY=' cdp/.env | cut -d= -f2- \
  | npx wrangler pages secret put ANCHOR_RELAY_KEY --project-name delta-truth-engine
```

## Run
```bash
cd ~/delta/cdp
npm install
npm run quickstart                       # create wallet → faucet → send (sanity check)
npm run anchor -- "A Mediterranean diet extends median lifespan"   # full Δ→chain→ledger
```

## Go to mainnet
Set `DELTA_NETWORK=base` in `cdp/.env` and fund the `delta-truth-anchor` wallet with real
ETH (the relayer prints its address). The faucet step is auto-skipped on mainnet.
