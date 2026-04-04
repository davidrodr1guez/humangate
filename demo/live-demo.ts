/**
 * live-demo.ts — THE DEMO FOR JUDGES
 *
 * Shows a real agent trying to access a faucet protected by HumanGate.
 *
 * Flow:
 *   1. Agent tries to access faucet → BLOCKED (not verified)
 *   2. Human registers the agent via HumanGate (World ID)
 *   3. Agent tries again → PASSES THE GATE
 *
 * Usage:
 *   GATEWAY=https://humangate-lake.vercel.app AGENT_KEY=0x... npx tsx live-demo.ts
 *
 * If no AGENT_KEY provided, generates a fresh wallet.
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";
import * as readline from "readline";

const GATEWAY = process.env.GATEWAY ?? "https://humangate-lake.vercel.app";

// ─── Colors ────────────────────────────────────────────
const c = {
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

// ─── Challenge-Response Auth ───────────────────────────
async function tryAccessFaucet(account: ReturnType<typeof privateKeyToAccount>): Promise<boolean> {
  // Step 1: Request challenge
  log("📋", `${c.dim}Requesting challenge from faucet...${c.reset}`);
  await sleep(500);

  const challengeRes = await fetch(`${GATEWAY}/api/challenge?agent=${account.address}`);
  const { nonce, message } = await challengeRes.json();
  log("📋", `${c.dim}Challenge received: ${nonce.slice(0, 16)}...${c.reset}`);
  await sleep(300);

  // Step 2: Sign challenge
  log("🔑", `${c.dim}Signing challenge with agent private key...${c.reset}`);
  await sleep(500);

  const signature = await account.signMessage({ message });
  log("🔑", `${c.dim}Signature: ${signature.slice(0, 20)}...${c.reset}`);
  await sleep(300);

  // Step 3: Submit
  log("📡", `${c.dim}Submitting signed challenge to faucet...${c.reset}`);
  await sleep(500);

  const authRes = await fetch(`${GATEWAY}/api/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent: account.address, nonce, signature }),
  });

  const result = await authRes.json();
  await sleep(300);

  if (result.authenticated && result.humanBacked) {
    return true;
  }

  if (result.authenticated && !result.humanBacked) {
    log("🔐", `${c.yellow}Identity confirmed, but agent is NOT in HumanGate whitelist${c.reset}`);
  } else {
    log("🔐", `${c.red}Authentication failed: ${result.reason || result.error}${c.reset}`);
  }

  return false;
}

// ─── Main ──────────────────────────────────────────────
async function main() {
  // Setup agent
  let privateKey: `0x${string}`;
  if (process.env.AGENT_KEY) {
    privateKey = process.env.AGENT_KEY as `0x${string}`;
  } else {
    privateKey = `0x${randomBytes(32).toString("hex")}`;
  }
  const account = privateKeyToAccount(privateKey);

  console.log("");
  console.log(`${c.bold}${c.cyan}  ╔══════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ║         HUMANGATE — LIVE DEMO                ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ║   The verification gateway for agents        ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ╚══════════════════════════════════════════════╝${c.reset}`);
  console.log("");
  log("🤖", `${c.bold}Agent starting...${c.reset}`);
  log("🤖", `${c.dim}Address: ${account.address}${c.reset}`);
  log("🤖", `${c.dim}Gateway: ${GATEWAY}${c.reset}`);
  console.log("");

  // ── ACT 1: Agent tries faucet — BLOCKED ──────────
  console.log(`${c.bold}${c.cyan}  ── ACT 1: Agent tries to access the faucet ──${c.reset}`);
  console.log("");

  log("🤖", `Task: claim tokens from a HumanGate-protected faucet`);
  await sleep(800);
  console.log("");

  const firstTry = await tryAccessFaucet(account);

  console.log("");
  if (!firstTry) {
    log("❌", `${c.red}${c.bold}BLOCKED — Agent cannot access the faucet${c.reset}`);
    log("🤖", `${c.dim}"I need my human to verify me through HumanGate first."${c.reset}`);
  }

  // ── ACT 2: Human registers the agent ─────────────
  console.log("");
  console.log(`${c.bold}${c.cyan}  ── ACT 2: Human registers the agent ──${c.reset}`);
  console.log("");

  log("👤", `${c.bold}Human: register this agent at HumanGate${c.reset}`);
  console.log("");
  console.log(`${c.yellow}     1. Go to: ${c.bold}${GATEWAY}${c.reset}`);
  console.log(`${c.yellow}     2. Click "I'm a human"${c.reset}`);
  console.log(`${c.yellow}     3. Agent name: any name you want${c.reset}`);
  console.log(`${c.yellow}     4. Click "I already have a wallet"${c.reset}`);
  console.log(`${c.yellow}     5. Paste this address:${c.reset}`);
  console.log(`${c.bold}        ${account.address}${c.reset}`);
  console.log(`${c.yellow}     6. Click "Verify with World ID" and scan QR${c.reset}`);
  console.log("");

  await waitForEnter(`  ${c.dim}Press ENTER when verification is complete...${c.reset}`);

  // ── ACT 3: Agent tries again — PASSES ────────────
  console.log("");
  console.log(`${c.bold}${c.cyan}  ── ACT 3: Agent retries the faucet ──${c.reset}`);
  console.log("");

  log("🤖", `Retrying faucet access...`);
  await sleep(500);
  console.log("");

  const secondTry = await tryAccessFaucet(account);

  console.log("");
  if (secondTry) {
    log("✅", `${c.green}${c.bold}ACCESS GRANTED — Agent is authenticated and human-backed${c.reset}`);
    await sleep(400);
    log("💰", `${c.green}Tokens claimed successfully!${c.reset}`);
    await sleep(400);
    console.log("");
    log("🎉", `${c.bold}The agent completed the task autonomously.${c.reset}`);
    log("🎉", `${c.bold}${c.green}The human never touched the faucet.${c.reset}`);
  } else {
    log("❌", `${c.red}Still blocked. Make sure you completed the verification.${c.reset}`);
  }

  console.log("");
}

main().catch(console.error);
