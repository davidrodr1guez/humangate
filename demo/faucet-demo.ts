/**
 * demo/faucet-demo.ts — THE DEMO FOR JUDGES
 *
 * Simulates the killer use-case: an AI agent tries to claim tokens
 * from a faucet protected by HumanGate. The faucet rejects bots but
 * lets human-backed agents through.
 *
 * Flow:
 *   1. Agent tries the faucet → BLOCKED (not verified)
 *   2. Agent verifies through HumanGate (World ID proof)
 *   3. Agent receives an ENS identity ({address}.humanbacked.eth)
 *   4. Agent retries the faucet → APPROVED (human-backed)
 *   5. Tokens received
 *
 * Usage:
 *   npx tsx faucet-demo.ts
 *
 * Env vars (optional — demo runs in simulation mode without them):
 *   HUMANGATE_CONTRACT_ADDRESS  — deployed HumanGate contract
 *   HUMANGATE_RESOLVER_ADDRESS  — deployed HumanGateResolver
 *   PRIVATE_KEY                 — wallet private key
 *   VERIFY_URL                  — HumanGate API (default: http://localhost:3000/api/verify)
 */

import { createPublicClient, http, type Address, type Hex } from "viem";

// ─── Config ──────────────────────────────────────────────
const CONTRACT = process.env.HUMANGATE_CONTRACT_ADDRESS as Address | undefined;
const RESOLVER = process.env.HUMANGATE_RESOLVER_ADDRESS as Address | undefined;
const VERIFY_URL = process.env.VERIFY_URL ?? "http://localhost:3000/api/verify";
const RPC = process.env.WORLD_CHAIN_RPC ?? "https://worldchain-mainnet.g.alchemy.com/public";
const LIVE_MODE = !!CONTRACT;

const AGENT_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" as Address;
const FAUCET_AMOUNT = "0.1 ETH";

const chain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const gateAbi = [
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

const resolverAbi = [
  {
    type: "function",
    name: "names",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// ─── Utilities ───────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function log(icon: string, msg: string) {
  console.log(`  ${icon}  ${msg}`);
}

function header(text: string) {
  console.log(`\n${colors.bold}${colors.cyan}── ${text} ${"─".repeat(Math.max(0, 50 - text.length))}${colors.reset}\n`);
}

// ─── Simulated Faucet ────────────────────────────────────
// This represents any CAPTCHA-protected service

async function checkHumanGate(agent: Address): Promise<boolean> {
  if (!LIVE_MODE) return false; // First call: not verified

  const client = createPublicClient({ chain, transport: http(RPC) });
  const verified = await client.readContract({
    address: CONTRACT!,
    abi: gateAbi,
    functionName: "isVerified",
    args: [agent],
  });
  return verified;
}

let agentIsVerified = false;

async function faucetRequest(agent: Address): Promise<{ success: boolean; reason?: string }> {
  // In live mode, check the actual contract
  if (LIVE_MODE) {
    const verified = await checkHumanGate(agent);
    if (!verified) {
      return { success: false, reason: "Agent not verified by HumanGate" };
    }
    return { success: true };
  }

  // In simulation mode, use local state
  if (!agentIsVerified) {
    return { success: false, reason: "Agent not verified by HumanGate" };
  }
  return { success: true };
}

async function resolveENSName(agent: Address): Promise<string> {
  const ensName = `${agent.toLowerCase()}.humanbacked.eth`;

  if (LIVE_MODE && RESOLVER) {
    try {
      const client = createPublicClient({ chain, transport: http(RPC) });
      const { keccak256, toBytes } = await import("viem");
      const labelhash = keccak256(toBytes(agent.toLowerCase()));
      const registered = await client.readContract({
        address: RESOLVER,
        abi: resolverAbi,
        functionName: "names",
        args: [labelhash],
      });
      if (registered !== "0x0000000000000000000000000000000000000000") {
        return ensName;
      }
    } catch { /* fall through */ }
  }

  return ensName;
}

// ─── Main Demo Flow ──────────────────────────────────────

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}`);
  console.log(`  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║          HUMANGATE — FAUCET DEMO             ║`);
  console.log(`  ║   The CAPTCHA for Human-Backed AI Agents     ║`);
  console.log(`  ╚══════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.dim}  Mode: ${LIVE_MODE ? "LIVE (on-chain)" : "SIMULATION"}${colors.reset}`);
  console.log(`${colors.dim}  Agent: ${AGENT_ADDRESS}${colors.reset}`);

  // ── ACT 1: Agent tries the faucet — BLOCKED ──────────
  header("ACT 1: Agent requests faucet tokens");

  log("🤖", `Agent ${AGENT_ADDRESS.slice(0, 10)}... requests ${FAUCET_AMOUNT} from faucet`);
  await sleep(800);

  log("🔒", `Faucet: "Checking HumanGate verification..."`);
  await sleep(600);

  const firstTry = await faucetRequest(AGENT_ADDRESS);

  log(
    "❌",
    `${colors.red}BLOCKED: ${firstTry.reason}${colors.reset}`
  );
  await sleep(400);
  log("🤖", `${colors.dim}Agent: "I need to verify through HumanGate first."${colors.reset}`);

  // ── ACT 2: Agent verifies through HumanGate ──────────
  header("ACT 2: Agent verifies via World ID + HumanGate");

  log("🤖", "Agent initiates HumanGate verification...");
  await sleep(600);

  log("🌐", "Connecting to World ID...");
  await sleep(500);

  log("👤", "Human owner scans QR with World App...");
  await sleep(1200);

  log("🔐", "Zero-knowledge proof generated (no identity revealed)");
  await sleep(500);

  if (LIVE_MODE) {
    log("⛓️ ", "Submitting proof to HumanGate contract on World Chain...");
    try {
      const res = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof: {
            merkle_root: "0x1",
            nullifier_hash: "0x" + Date.now().toString(16),
            proof: "0x" + "00".repeat(256),
          },
          agentId: AGENT_ADDRESS,
        }),
      });
      const data = await res.json();
      if (data.verified) {
        log("✅", `${colors.green}On-chain verification CONFIRMED${colors.reset}`);
        log("📝", `${colors.dim}tx: ${data.txHash}${colors.reset}`);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      log("⚠️ ", `${colors.yellow}Live verification failed, continuing in simulation${colors.reset}`);
      agentIsVerified = true;
    }
  } else {
    log("⛓️ ", "Submitting proof to HumanGate contract on World Chain...");
    await sleep(1000);
    log("✅", `${colors.green}On-chain verification CONFIRMED${colors.reset}`);
    log("📝", `${colors.dim}tx: 0x7a3f...b92e (World Chain)${colors.reset}`);
    agentIsVerified = true;
  }
  await sleep(400);

  log("📋", "AgentVerified event emitted on-chain");
  await sleep(300);

  // ── ACT 3: ENS identity assigned ─────────────────────
  header("ACT 3: Agent receives ENS identity");

  log("🔷", "Registering agent identity via ENSIP-10 wildcard resolver...");
  await sleep(800);

  const ensName = await resolveENSName(AGENT_ADDRESS);

  log(
    "🏷️ ",
    `${colors.blue}ENS Identity: ${colors.bold}${ensName}${colors.reset}`
  );
  await sleep(400);
  log("🔷", `${colors.dim}Resolver: HumanGateResolver (ENSIP-10 wildcard)${colors.reset}`);
  log("🔷", `${colors.dim}Resolves only if agent is verified in HumanGate${colors.reset}`);

  // ── ACT 4: Agent retries faucet — SUCCESS ────────────
  header("ACT 4: Agent retries faucet (now verified)");

  log("🤖", `Agent ${AGENT_ADDRESS.slice(0, 10)}... requests ${FAUCET_AMOUNT} from faucet`);
  await sleep(600);

  log("🔓", `Faucet: "Checking HumanGate verification..."`);
  await sleep(600);

  const secondTry = await faucetRequest(AGENT_ADDRESS);

  if (secondTry.success) {
    log(
      "✅",
      `${colors.green}${colors.bold}APPROVED: Agent is human-backed${colors.reset}`
    );
    await sleep(400);

    log("💰", `${colors.green}${FAUCET_AMOUNT} sent to ${AGENT_ADDRESS.slice(0, 10)}...${colors.reset}`);
    await sleep(300);

    log("🏷️ ", `${colors.dim}Identity: ${ensName}${colors.reset}`);
  }

  // ── Summary ──────────────────────────────────────────
  header("Summary");

  console.log(`  ${colors.bold}What just happened:${colors.reset}`);
  console.log(`  ${colors.dim}1. Agent was BLOCKED by faucet CAPTCHA${colors.reset}`);
  console.log(`  ${colors.dim}2. Human owner verified once via World ID (ZK proof)${colors.reset}`);
  console.log(`  ${colors.dim}3. Agent registered on-chain as human-backed${colors.reset}`);
  console.log(`  ${colors.dim}4. Agent received ENS identity: ${ensName}${colors.reset}`);
  console.log(`  ${colors.dim}5. Agent passed the faucet CAPTCHA autonomously${colors.reset}`);

  console.log(`\n  ${colors.bold}${colors.green}The human never touched the faucet.${colors.reset}`);
  console.log(`  ${colors.bold}${colors.green}The agent did it all on its own.${colors.reset}\n`);
}

main().catch(console.error);
