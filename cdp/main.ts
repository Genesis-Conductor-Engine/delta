// CDP API-key wallet quickstart: create a non-custodial EVM account, fund it from
// the Base Sepolia faucet, and send a transaction. Run: npm run quickstart
// Requires cdp/.env: CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET.
import { CdpClient } from "@coinbase/cdp-sdk";
import { http, createPublicClient, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

function requireCreds() {
  const missing = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\n✗ Missing CDP credentials in cdp/.env: ${missing.join(", ")}`);
    console.error("  See cdp/README.md → fill them from portal.cdp.coinbase.com (do not paste in chat).\n");
    process.exit(1);
  }
}

async function main() {
  requireCreds();
  const cdp = new CdpClient();
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

  const account = await cdp.evm.createAccount();
  console.log("Wallet address:", account.address);

  const { transactionHash: faucetHash } = await cdp.evm.requestFaucet({
    address: account.address,
    network: "base-sepolia",
    token: "eth",
  });
  await publicClient.waitForTransactionReceipt({ hash: faucetHash });
  await new Promise((r) => setTimeout(r, 3000)); // CDP API balance sync delay

  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    transaction: { to: account.address, value: parseEther("0.000001") },
    network: "base-sepolia",
  });
  await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  console.log("View on BaseScan: https://sepolia.basescan.org/tx/" + transactionHash);
}

main().catch((e) => { console.error(e); process.exit(1); });
