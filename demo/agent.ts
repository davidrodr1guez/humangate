/**
 * demo/agent.ts — Simulates an AI agent performing HumanGate verification
 * programmatically (no browser UI).
 *
 * Flow:
 *   1. Create a World ID verification request via IDKit Core
 *   2. Print the connector URI (scan with World App or Simulator)
 *   3. Poll until proof is received
 *   4. POST the proof to the HumanGate /api/verify endpoint
 *   5. Print the resulting session token
 *
 * Usage:
 *   AGENT_ADDRESS=0x... VERIFY_URL=http://localhost:3000/api/verify npx tsx agent.ts
 */

import { createPublicClient, http, type Address, type Hex } from "viem";

// ---------- Config ----------
const AGENT_ADDRESS = process.env.AGENT_ADDRESS as Address;
const VERIFY_URL = process.env.VERIFY_URL ?? "http://localhost:3000/api/verify";
const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx";
const ACTION = "verify-agent";

// Contract read (optional — check status after verification)
const CONTRACT_ADDRESS = process.env.HUMANGATE_CONTRACT_ADDRESS as Address | undefined;
const RPC_URL = process.env.WORLD_CHAIN_SEPOLIA_RPC ?? "https://worldchain-sepolia.g.alchemy.com/public";

const abi = [
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

// ---------- Main ----------
async function main() {
  if (!AGENT_ADDRESS) {
    console.error("Set AGENT_ADDRESS env var (the agent wallet to verify)");
    process.exit(1);
  }

  console.log("=== HumanGate Agent Verification ===");
  console.log(`Agent  : ${AGENT_ADDRESS}`);
  console.log(`Action : ${ACTION}`);
  console.log(`API    : ${VERIFY_URL}\n`);

  // Step 1 — Create IDKit request
  console.log("[1/4] Creating World ID verification request...");

  let IDKit: any;
  try {
    IDKit = await import("@worldcoin/idkit-core");
  } catch {
    console.log("  @worldcoin/idkit-core not available, using manual flow.\n");
    await manualFlow();
    return;
  }

  const request = await IDKit.request({
    app_id: APP_ID,
    action: ACTION,
    signal: AGENT_ADDRESS,
    environment: "staging", // use simulator for testing
  });

  // Step 2 — Print connector URI
  console.log("[2/4] Scan this with World App (or Simulator):\n");
  console.log(`  ${request.connectorURI}\n`);

  // Step 3 — Poll for completion
  console.log("[3/4] Waiting for proof...");
  const result = await request.pollUntilCompletion();
  console.log("  Proof received!\n");

  // Step 4 — Submit to HumanGate API
  console.log("[4/4] Submitting to HumanGate API...");
  await submitProof(result);
}

async function manualFlow() {
  console.log("=== Manual / Mock Flow ===");
  console.log("In production, IDKit Core generates a QR that the user scans");
  console.log("with World App to produce a ZK proof.\n");
  console.log("For local testing without World App:");
  console.log("  1. Run the widget at http://localhost:3000/widget");
  console.log("  2. Use the World ID Simulator at https://simulator.worldcoin.org\n");

  // Check on-chain status if contract is configured
  if (CONTRACT_ADDRESS) {
    console.log("Checking on-chain verification status...");
    const client = createPublicClient({
      chain: {
        id: 4801,
        name: "World Chain Sepolia",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
        testnet: true,
      },
      transport: http(RPC_URL),
    });

    const verified = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: "isVerified",
      args: [AGENT_ADDRESS],
    });

    console.log(`  Agent ${AGENT_ADDRESS} is ${verified ? "VERIFIED" : "NOT VERIFIED"}`);
  }
}

async function submitProof(proof: any) {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proof: {
        merkle_root: proof.merkle_root,
        nullifier_hash: proof.nullifier_hash,
        proof: proof.proof,
      },
      agentId: AGENT_ADDRESS,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`  Error: ${data.error}`);
    process.exit(1);
  }

  console.log("\n=== Verification Complete ===");
  console.log(`  Verified : ${data.verified}`);
  console.log(`  TX Hash  : ${data.txHash}`);
  console.log(`  Token    : ${data.sessionToken}`);

  // Optional: verify on-chain
  if (CONTRACT_ADDRESS) {
    const client = createPublicClient({
      chain: {
        id: 4801,
        name: "World Chain Sepolia",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
        testnet: true,
      },
      transport: http(RPC_URL),
    });

    const onChain = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: "isVerified",
      args: [AGENT_ADDRESS],
    });
    console.log(`  On-chain : ${onChain ? "VERIFIED" : "NOT VERIFIED"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
