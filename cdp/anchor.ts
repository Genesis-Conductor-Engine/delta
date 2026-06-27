// Δ Truth on-chain anchor relayer.
//   1) Ask the live Delta API to verify + anchor a claim   → { block, hash, … }
//   2) Write a REAL on-chain proof tx from a CDP non-custodial wallet
//      (calldata embeds "Δ#<block> <hash>")                → transactionHash
//   3) Link the tx back into the D1 ledger via the relay-key-authed callback
//
// Usage: npm run anchor -- "A Mediterranean diet extends median lifespan"
// Env (cdp/.env): CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET,
//                 DELTA_API_BASE, ANCHOR_RELAY_KEY, DELTA_NETWORK.
import { CdpClient } from "@coinbase/cdp-sdk";
import { http, createPublicClient, toHex } from "viem";
import { baseSepolia, base } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const API = process.env.DELTA_API_BASE || "https://delta.genesisconductor.io";
const NETWORK = (process.env.DELTA_NETWORK || "base-sepolia") as "base-sepolia" | "base";
const RELAY_KEY = process.env.ANCHOR_RELAY_KEY || "";
const CHAIN = NETWORK === "base" ? base : baseSepolia;
const SCAN = NETWORK === "base" ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";

function requireCreds() {
  const missing = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\n✗ Missing CDP credentials in cdp/.env: ${missing.join(", ")}`);
    console.error("  Fill them from portal.cdp.coinbase.com (see cdp/README.md). Do not paste in chat.\n");
    process.exit(1);
  }
}

async function main() {
  const claim = process.argv.slice(2).join(" ").trim();
  if (!claim) { console.error('Usage: npm run anchor -- "your claim here"'); process.exit(1); }
  requireCreds();

  // 1) Verify + anchor in the Delta ledger (server re-verifies; forgery-resistant).
  const aRes = await fetch(`${API}/api/anchor`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ claim }),
  });
  if (!aRes.ok) throw new Error(`/api/anchor ${aRes.status}: ${await aRes.text()}`);
  const reading = await aRes.json();
  console.log(`Δ verified  tier=${reading.tier}  div=${reading.div}  block=#${reading.block}  hash=${reading.hash}`);

  // 2) Real on-chain proof from a stable CDP wallet.
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({ name: "delta-truth-anchor" });
  console.log("Anchor wallet:", account.address);

  const publicClient = createPublicClient({ chain: CHAIN, transport: http() });

  if (NETWORK === "base-sepolia") {
    try {
      const { transactionHash: f } = await cdp.evm.requestFaucet({ address: account.address, network: "base-sepolia", token: "eth" });
      await publicClient.waitForTransactionReceipt({ hash: f });
      await new Promise((r) => setTimeout(r, 4000));
    } catch (e: any) { console.warn("faucet skipped:", e?.message || e); }
  }

  const memo = `Δ#${reading.block} ${reading.hash} div=${reading.div} tier=${reading.tier}`;
  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    transaction: { to: account.address, value: 0n, data: toHex(memo) },
    network: NETWORK,
  });
  await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  console.log("On-chain proof:", SCAN + transactionHash);

  // 3) Link the tx into the D1 ledger.
  const cb = await fetch(`${API}/api/anchor/onchain`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-relay-key": RELAY_KEY },
    body: JSON.stringify({ block: reading.block, onchain_tx: transactionHash, onchain_addr: account.address, onchain_network: NETWORK }),
  });
  console.log(cb.ok ? "Ledger linked ✓" : `Ledger link failed: ${cb.status} ${await cb.text()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
