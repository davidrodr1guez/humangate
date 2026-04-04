/**
 * live-demo.ts — THE DEMO FOR JUDGES
 *
 * Simulates a real AI agent working on a task.
 * The agent needs testnet tokens to deploy a contract,
 * but the faucet is protected by HumanGate.
 *
 * Usage:
 *   GATEWAY=https://humangate-lake.vercel.app npx tsx live-demo.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";
import * as readline from "readline";

const GATEWAY = process.env.GATEWAY ?? "https://humangate-lake.vercel.app";

const c = {
  reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m", dim: "\x1b[2m", bold: "\x1b[1m",
  magenta: "\x1b[35m",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => { rl.question(prompt, () => { rl.close(); resolve(); }); });
}

async function tryFaucet(account: ReturnType<typeof privateKeyToAccount>): Promise<boolean> {
  const challengeRes = await fetch(`${GATEWAY}/api/challenge?agent=${account.address}`);
  const { nonce, message } = await challengeRes.json();
  const signature = await account.signMessage({ message });
  const authRes = await fetch(`${GATEWAY}/api/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent: account.address, nonce, signature }),
  });
  const result = await authRes.json();
  return result.authenticated && result.humanBacked;
}

async function main() {
  const privateKey = process.env.AGENT_KEY
    ? process.env.AGENT_KEY as `0x${string}`
    : `0x${randomBytes(32).toString("hex")}`;
  const account = privateKeyToAccount(privateKey);

  console.clear();
  console.log("");
  console.log(`${c.bold}${c.cyan}  ╔══════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ║            HUMANGATE — LIVE DEMO                 ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ╚══════════════════════════════════════════════════╝${c.reset}`);
  console.log("");

  // ── User gives task to agent ──
  console.log(`  ${c.bold}${c.blue}You:${c.reset} Hey agent, I need you to deploy my smart contract`);
  console.log(`       to the testnet. Here's the contract file.`);
  await sleep(2000);
  console.log("");

  console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} Got it! Let me deploy that for you.`);
  await sleep(1500);
  console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} First I need testnet tokens for gas fees.`);
  await sleep(1000);
  console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} Let me grab some from the faucet...`);
  await sleep(1500);
  console.log("");

  // ── Agent tries faucet ──
  console.log(`  ${c.dim}─── Agent accessing faucet ───${c.reset}`);
  console.log("");

  console.log(`  ${c.dim}  [1/3] Requesting access challenge...${c.reset}`);
  await sleep(800);
  console.log(`  ${c.dim}  [2/3] Signing with my wallet key...${c.reset}`);
  await sleep(800);
  console.log(`  ${c.dim}  [3/3] Submitting to faucet...${c.reset}`);
  await sleep(1000);

  const firstTry = await tryFaucet(account);
  console.log("");

  if (!firstTry) {
    console.log(`  ${c.red}${c.bold}  ✗ FAUCET: Access denied — agent not in HumanGate whitelist${c.reset}`);
    console.log("");
    await sleep(1500);

    console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} I got blocked by HumanGate. The faucet requires`);
    console.log(`         proof that I'm backed by a real human.`);
    await sleep(1500);
    console.log("");

    console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} ${c.yellow}I need you to verify me once. After that,${c.reset}`);
    console.log(`         ${c.yellow}I'll be able to access any protected service on my own.${c.reset}`);
    await sleep(1000);
    console.log("");

    console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} Here's what to do:`);
    console.log("");
    console.log(`         ${c.bold}1.${c.reset} Go to ${c.cyan}${c.bold}${GATEWAY}${c.reset}`);
    console.log(`         ${c.bold}2.${c.reset} Click ${c.bold}"I'm a human"${c.reset}`);
    console.log(`         ${c.bold}3.${c.reset} Name me anything you want`);
    console.log(`         ${c.bold}4.${c.reset} Click "I already have a wallet" and paste:`);
    console.log(`            ${c.bold}${account.address}${c.reset}`);
    console.log(`         ${c.bold}5.${c.reset} Click ${c.bold}"Verify with World ID"${c.reset} and scan the QR`);
    console.log("");
    console.log(`         ${c.dim}This is one-time only. You'll never need to do this again.${c.reset}`);
    console.log("");

    await waitForEnter(`  ${c.dim}Press ENTER when you've completed the verification...${c.reset}`);
  }

  // ── Agent retries ──
  console.log("");
  console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} Thanks! Let me try the faucet again...`);
  await sleep(1500);
  console.log("");

  console.log(`  ${c.dim}─── Agent accessing faucet (retry) ───${c.reset}`);
  console.log("");

  console.log(`  ${c.dim}  [1/3] Requesting access challenge...${c.reset}`);
  await sleep(800);
  console.log(`  ${c.dim}  [2/3] Signing with my wallet key...${c.reset}`);
  await sleep(800);
  console.log(`  ${c.dim}  [3/3] Submitting to faucet...${c.reset}`);
  await sleep(1000);

  const secondTry = await tryFaucet(account);
  console.log("");

  if (secondTry) {
    console.log(`  ${c.green}${c.bold}  ✓ FAUCET: Access granted — agent is human-backed${c.reset}`);
    await sleep(1000);
    console.log(`  ${c.green}${c.bold}  ✓ FAUCET: 0.1 ETH sent to agent${c.reset}`);
    console.log("");
    await sleep(1500);

    console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} Got the tokens! Now deploying your contract...`);
    await sleep(1500);
    console.log(`  ${c.dim}  Compiling contract...${c.reset}`);
    await sleep(1000);
    console.log(`  ${c.dim}  Deploying to testnet...${c.reset}`);
    await sleep(1500);
    console.log(`  ${c.dim}  Contract deployed at 0x7a3f...b92e${c.reset}`);
    console.log("");
    await sleep(1000);

    console.log(`  ${c.bold}${c.magenta}Agent:${c.reset} ${c.green}Done! Your contract is deployed.${c.reset}`);
    console.log(`         ${c.green}Contract: 0x7a3f...b92e${c.reset}`);
    console.log("");
    await sleep(1000);

    console.log(`  ${c.dim}──────────────────────────────────────────${c.reset}`);
    console.log("");
    console.log(`  ${c.bold}What just happened:${c.reset}`);
    console.log(`  ${c.dim}1. You asked your agent to deploy a contract${c.reset}`);
    console.log(`  ${c.dim}2. The agent needed tokens → tried the faucet → got blocked${c.reset}`);
    console.log(`  ${c.dim}3. You verified once with World ID (one-time)${c.reset}`);
    console.log(`  ${c.dim}4. The agent passed the gate and got the tokens${c.reset}`);
    console.log(`  ${c.dim}5. The agent deployed the contract${c.reset}`);
    console.log("");
    console.log(`  ${c.bold}${c.green}You never touched the faucet.${c.reset}`);
    console.log(`  ${c.bold}${c.green}The agent did everything after your one-time verification.${c.reset}`);
    console.log(`  ${c.bold}${c.green}Next time, it won't even need to ask.${c.reset}`);
    console.log("");
  } else {
    console.log(`  ${c.red}${c.bold}  ✗ Still blocked. Make sure you completed the verification.${c.reset}`);
    console.log("");
  }
}

main().catch(console.error);
