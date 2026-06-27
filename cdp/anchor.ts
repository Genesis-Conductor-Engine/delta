// Δ Truth on-chain anchor relayer with Policy Engine protection.
//   1) Ensure the anchor wallet has a spend policy (≤ 0.02 ETH/tx, allowlisted destinations)
//   2) Ask the live Delta API to verify + anchor a claim   → { block, hash, … }
//   3) Write a REAL on-chain proof tx from the CDP wallet  → transactionHash
//      (calldata: "Δ#<block> <hash> div=X tier=Y")
//   4) Link the tx into the D1 ledger via relay-key auth   → BaseScan URL in ledger
//
// Usage: npm run anchor -- "A Mediterranean diet extends median lifespan"
// Env (cdp/.env): CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET,
//                 DELTA_API_BASE, ANCHOR_RELAY_KEY, DELTA_NETWORK.
import { CdpClient } from "@coinbase/cdp-sdk";
import { http, createPublicClient, toHex } from "viem";
import { baseSepolia, base } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const API      = process.env.DELTA_API_BASE    || "https://delta.genesisconductor.io";
const NETWORK  = (process.env.DELTA_NETWORK    || "base-sepolia") as "base-sepolia" | "base";
const RELAY_KEY = process.env.ANCHOR_RELAY_KEY || "";
const CHAIN    = NETWORK === "base" ? base : baseSepolia;
const SCAN     = NETWORK === "base"
  ? "https://basescan.org/tx/"
  : "https://sepolia.basescan.org/tx/";

// Spend cap aligned with the Aerodrome LP per-tx cap (0.02 ETH) from caps.json.
const MAX_ETH_PER_TX_WEI = "20000000000000000"; // 0.02 ETH in wei

// Allowlisted destinations: only self-sends + pool + router (matches Aerodrome LP allowlist).
// On testnet, allow self-send only (address filled in at runtime).
const MAINNET_ALLOWLIST = [
  "0x4aBC6D796cd036b6f1E433A97F9784a00f90C53e", // wQFLOP/WETH pool
  "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", // Aerodrome Router
];

function requireCreds() {
  const missing = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`\n✗ Missing CDP credentials in cdp/.env: ${missing.join(", ")}`);
    console.error("  Fill them from portal.cdp.coinbase.com (see cdp/README.md).\n");
    process.exit(1);
  }
}

/** Ensure the anchor account has a policy: max 0.02 ETH/tx, destination allowlist. */
async function ensurePolicy(cdp: CdpClient, accountAddress: string): Promise<void> {
  const selfAllowlist = [accountAddress, ...( NETWORK === "base" ? MAINNET_ALLOWLIST : [])];

  try {
    const existing = await (cdp as any).policies?.listPolicies?.({ scope: "account" });
    if (existing?.policies?.length) {
      console.log(`  policy: ${existing.policies[0].id} (existing, skipping create)`);
      return;
    }
  } catch { /* API may not expose listPolicies — proceed to create */ }

  try {
    const policy = await (cdp as any).policies.createPolicy({
      policy: {
        scope: "account",
        description: `Δ Truth anchor wallet — max ${MAX_ETH_PER_TX_WEI} wei/tx, allowlisted destinations`,
        rules: [
          {
            action: "accept",
            operation: "signEvmTransaction",
            criteria: [
              { type: "ethValue", ethValue: MAX_ETH_PER_TX_WEI, operator: "<=" },
              { type: "evmAddress", addresses: selfAllowlist, operator: "in" },
            ],
          },
        ],
      },
    });
    await (cdp as any).evm.updateAccount({
      address: accountAddress,
      update: { accountPolicy: policy.id },
    });
    console.log(`  policy created + applied: ${policy.id}`);
  } catch (e: any) {
    // Policy Engine may require additional key scope (Non-custodial > Manage).
    // Safe to continue without it — the key-level caps still apply.
    console.warn(`  policy setup skipped (needs 'Non-custodial: Manage' scope): ${e?.message || e}`);
  }
}

async function main() {
  const claim = process.argv.slice(2).join(" ").trim();
  if (!claim) {
    console.error('Usage: npm run anchor -- "your claim here"');
    process.exit(1);
  }
  requireCreds();

  // ── Step 1: Verify + anchor in the Delta ledger ──────────────────────────────
  console.log(`\nΔ anchoring: "${claim.slice(0, 60)}${claim.length > 60 ? "…" : ""}"`);
  const aRes = await fetch(`${API}/api/anchor`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ claim }),
  });
  if (!aRes.ok) throw new Error(`/api/anchor ${aRes.status}: ${await aRes.text()}`);
  const reading = await aRes.json() as any;
  console.log(`  tier=${reading.tier}  div=${reading.div}  block=#${reading.block}  hash=${reading.hash}`);

  // ── Step 2: CDP wallet ────────────────────────────────────────────────────────
  const cdp = new CdpClient();
  // getOrCreateAccount ensures the same wallet address across every run (stable identity).
  const account = await cdp.evm.getOrCreateAccount({ name: "delta-truth-anchor" });
  console.log(`  wallet: ${account.address}`);

  // Apply Policy Engine spend limits (idempotent — skips if already set or scope missing).
  await ensurePolicy(cdp, account.address);

  const publicClient = createPublicClient({ chain: CHAIN, transport: http() });

  // Faucet on testnet (skipped on mainnet, retried on rate-limit).
  if (NETWORK === "base-sepolia") {
    try {
      const { transactionHash: f } = await cdp.evm.requestFaucet({
        address: account.address, network: "base-sepolia", token: "eth",
      });
      console.log(`  faucet: ${SCAN}${f}`);
      await publicClient.waitForTransactionReceipt({ hash: f as `0x${string}` });
      await new Promise((r) => setTimeout(r, 4000));
    } catch (e: any) {
      console.warn(`  faucet skipped (rate-limit or funded): ${e?.message || e}`);
    }
  }

  // ── Step 3: On-chain proof tx ─────────────────────────────────────────────────
  // calldata encodes the RTPTPA reading into permanent chain history.
  const memo = `Δ#${reading.block} ${reading.hash} div=${reading.div} tier=${reading.tier} cons=${reading.consensus}%`;
  console.log(`  proof calldata: "${memo}"`);

  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    transaction: {
      to: account.address as `0x${string}`, // self-send (allowlisted)
      value: 0n,
      data: toHex(memo),
    },
    network: NETWORK,
  });
  await publicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  console.log(`  on-chain proof: ${SCAN}${transactionHash}`);

  // ── Step 4: Link into D1 ledger ───────────────────────────────────────────────
  const cb = await fetch(`${API}/api/anchor/onchain`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-relay-key": RELAY_KEY },
    body: JSON.stringify({
      block: reading.block,
      onchain_tx: transactionHash,
      onchain_addr: account.address,
      onchain_network: NETWORK,
    }),
  });
  const cbBody = await cb.json() as any;
  if (cb.ok) {
    console.log(`  ledger linked ✓  BaseScan: ${cbBody.onchain_url}`);
  } else {
    console.warn(`  ledger link failed (${cb.status}): ${JSON.stringify(cbBody)}`);
    if (cb.status === 401) console.warn("  → register ANCHOR_RELAY_KEY Pages secret (see cdp/README.md)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
