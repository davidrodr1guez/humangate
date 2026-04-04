<p align="center">
  <img src="https://img.shields.io/badge/ETHGlobal-Cannes_2026-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/World_Chain-Mainnet-10b981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Tests-11%2F11_passing-10b981?style=for-the-badge" />
</p>

<h1 align="center">HumanGate</h1>

<p align="center">
  <strong>The verification gateway for the agentic web</strong>
  <br/>
  <em>A shared on-chain whitelist of human-backed AI agents. Verify once. Agent forever.</em>
</p>

<p align="center">
  <a href="#problem">Problem</a> &bull;
  <a href="#solution">Solution</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#deployed-contracts">Contracts</a> &bull;
  <a href="#demo">Demo</a> &bull;
  <a href="#tracks">Tracks</a> &bull;
  <a href="#getting-started">Getting Started</a>
</p>

---

## Problem

75%+ of internet traffic is bots. Services have two bad options: block all agents (losing legitimate traffic) or allow everything (getting gamed by bots). There is no shared way to distinguish a human-backed agent from a malicious bot.

Every service maintains its own auth — CAPTCHAs, API keys, rate limits. None of them answer the real question: *"Is there a real human behind this agent?"*

## Solution

HumanGate is a **verification gateway** — a shared on-chain whitelist of human-backed AI agents, powered by World ID.

```
                    ┌──────────────────────┐
   Agents           │    HumanGate         │        Services
   (bots +          │    Gateway           │        (faucets, dapps,
    human-backed)   │                      │         APIs, etc.)
        ───────────>│  on-chain whitelist   │───────────>
                    │  + EIP-712 passes    │
                    │                      │
                    │  ✓ human-backed      │──> ACCESS
                    │  ✗ not verified      │──> BLOCKED
                    └──────────────────────┘
```

**How it works:**

1. A human verifies **once** with World ID (ZK proof, Orb level)
2. The agent's address gets **whitelisted on-chain** (`verifiedAgents[address] = true`)
3. The agent receives an **ENS identity** (`{address}.humanbacked.eth`) and an **EIP-712 signed pass**
4. Any service checks the whitelist — on-chain (`isVerified()`) or off-chain (`verifyPass()`, pure ecrecover, 1ms, no gas)
5. The agent passes the gateway **autonomously, forever** — the human never intervenes again

> Think of it as a **shared API gateway for the agentic web**, but instead of API keys, it uses proof-of-humanity. Every service behind the gateway inherits the same trust layer — no need for each service to build its own bot detection.

## How It Works

```
                           ONE-TIME SETUP (human present)
                          ================================

  Human                World App              HumanGate API              World Chain
    |                     |                        |                         |
    |--- scan QR -------->|                        |                         |
    |                     |--- ZK proof ---------->|                         |
    |                     |                        |--- verifyAgent() ------>|
    |                     |                        |<-- tx confirmed --------|
    |                     |                        |--- registerAgent() ---->|
    |                     |                        |<-- ENS + text records --|
    |                     |                        |                         |
    |<-- pass issued -----|<-- EIP-712 signature --|                         |


                        AUTONOMOUS USAGE (agent alone)
                       ==================================

  Agent                  Any Service           HumanGate SDK
    |                        |                      |
    |--- present pass ------>|                      |
    |                        |--- verifyPass() ---->|
    |                        |<-- { valid: true } --|
    |<-- ACCESS GRANTED -----|                      |
    |                        |                      |
    |  (no human needed)     | (no gas, no RPC,     |
    |  (no World App)        |  pure ecrecover)     |
```

### The Flow

1. **Human verifies once** — World ID ZK proof at Orb verification level
2. **Agent registered on-chain** — `HumanGate.sol` verifies the proof via WorldID Router and marks the agent as human-backed
3. **ENS identity assigned** — `HumanGateResolver.sol` creates `{address}.humanbacked.eth` with rich text records (ENSIP-10 wildcard + ENSIP-25 verification loop)
4. **EIP-712 pass issued** — Portable signed credential the agent carries
5. **Agent operates forever** — Presents the pass at any service. Verification is pure `ecrecover` — 1ms, zero gas, zero network calls

## Deployed Contracts

> **World Chain Mainnet** (chainId: 480)

| Contract | Address | Explorer |
|----------|---------|----------|
| **HumanGate** | `0x5E721782a33Ea3b668C69fDa3Fb80C71aFae5D6a` | [WorldScan](https://worldscan.org/address/0x5E721782a33Ea3b668C69fDa3Fb80C71aFae5D6a) |
| **HumanGateResolver** | `0xE6009c215F10257795d2c29F64eAc1A28082b640` | [WorldScan](https://worldscan.org/address/0xE6009c215F10257795d2c29F64eAc1A28082b640) |

Uses [WorldID Router](https://worldscan.org/address/0x17B354dD2595411ff79041f930e491A4Df39A278) (`0x17B354dD...`) for on-chain proof verification.

## Demo

### `/demo` — The CAPTCHA Replacement

A token faucet protected by HumanGate. The content is **blurred and locked** until the agent proves it's human-backed:

- Unverified agent arrives → **BLOCKED** (content locked)
- Agent presents its credential → on-chain check → **ACCESS GRANTED**
- No puzzle, no QR scan, no human intervention

### `/widget` — Verification Flow

3-step guided flow:
1. Enter agent address
2. Verify with World ID (scan QR with World App)
3. Receive: on-chain registration + ENS identity + EIP-712 pass

### `/dashboard` — Agent Lookup

Query any address to check its on-chain verification status and ENS identity.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14)                     │
│                                                                  │
│  /demo          /widget           /dashboard                     │
│  CAPTCHA-like   IDKit v4 +        On-chain                      │
│  gate demo      verification      agent lookup                   │
└──────┬──────────────┬──────────────────┬─────────────────────────┘
       │              │                  │
       ▼              ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                          API LAYER                               │
│                                                                  │
│  /api/verify        /api/check-pass       /api/rp-signature      │
│  Full pipeline:     EIP-712 pass          RP signing for         │
│  on-chain verify    validation            IDKit v4               │
│  + ENS register     (ecrecover,                                  │
│  + sign pass        no gas)                                      │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    WORLD CHAIN (chainId: 480)                    │
│                                                                  │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │    HumanGate.sol     │    │   HumanGateResolver.sol        │  │
│  │                      │    │                                │  │
│  │  verifyAgent()       │    │  registerAgent()               │  │
│  │  isVerified()        │    │  text() / setText()            │  │
│  │                      │    │  resolve() [ENSIP-10]          │  │
│  │  WorldID Router ──┐  │    │                                │  │
│  │  ZK proof verify  │  │───>│  {addr}.humanbacked.eth        │  │
│  │  Nullifier check  │  │    │  Text records (6 default)      │  │
│  │  Sybil resistance │  │    │  ENSIP-25 verification loop    │  │
│  └───────────────────┘  │    └────────────────────────────────┘  │
│                          │                                        │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SDK (TypeScript + viem)                       │
│                                                                  │
│  verifyPass()          — Local pass verification (ecrecover)     │
│  isAgentVerified()     — On-chain status check                   │
│  verifyAgentOnChain()  — Submit proof to contract                │
│  getPassDomain()       — EIP-712 domain for any integration      │
└──────────────────────────────────────────────────────────────────┘
```

## Smart Contracts

### HumanGate.sol

Core verification contract. Receives a World ID ZK proof, verifies it via the WorldID Router, and marks the agent as human-backed.

```solidity
function verifyAgent(
    address agent,
    uint256 root,
    uint256 nullifierHash,
    uint256[8] calldata proof
) external
```

- Verifies ZK proof via `IWorldID.verifyProof()`
- Prevents double-verification (nullifier uniqueness)
- Emits `AgentVerified(agent, nullifierHash)`
- Read status: `isVerified(address agent) → bool`

### HumanGateResolver.sol

ENSIP-10 wildcard resolver with ENSIP-25 verification loop. Gives verified agents an ENS identity with rich metadata.

```solidity
function registerAgent(address agent) external     // Register + set 6 default text records
function setText(address agent, string key, string value) external  // Custom metadata
function text(address agent, string key) → string   // Read text records
function resolve(bytes name, bytes data) → bytes    // ENSIP-10 wildcard (addr + text)
```

**Default text records set on registration:**

| Key | Example Value |
|-----|---------------|
| `humangate.verified` | `"true"` |
| `humangate.verifiedAt` | `"1712188800"` |
| `humangate.contract` | `"0x5E72..."` |
| `humangate.resolver` | `"0xE600..."` |
| `humangate.chain` | `"480"` |
| `description` | `"Human-backed AI agent verified via HumanGate + World ID on World Chain"` |

**Interface support:** ExtendedResolver (`0x9061b923`) + ITextResolver (`0x59d1d43c`) + ERC-165

## EIP-712 Pass System

After on-chain verification, the backend signs a portable credential the agent carries everywhere.

```
Domain: { name: "HumanGate", version: "1", chainId: 480, verifyingContract: <HumanGate> }

HumanGatePass {
    agent: address       // The verified agent
    nullifier: uint256   // Anonymized human identifier
    issuedAt: uint256    // Timestamp
    expiresAt: uint256   // 24h expiry
}
```

**Any service verifies with one function call:**

```typescript
import { verifyPass } from "@humangate/sdk";

const result = await verifyPass(agentPass, contractAddress);
// { valid: true } — no API, no RPC, no gas. Pure ecrecover.
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Identity | **World Agent Kit** | Agent authorization by verified humans |
| Proof | **World ID 4.0 + IDKit v4** | ZK proof of personhood (Orb level) |
| Naming | **ENS (ENSIP-10 + ENSIP-25)** | Wildcard resolver + text records + verification loop |
| Credential | **EIP-712** | Portable signed pass for autonomous access |
| Chain | **World Chain (480)** | Mainnet deployment |
| Frontend | **Next.js 14 + Tailwind CSS** | Widget, dashboard, demo, APIs |
| Contracts | **Solidity 0.8.24 / Hardhat** | On-chain verification + ENS resolver |
| SDK | **TypeScript + viem** | Client library with `verifyPass()` |

## Project Structure

```
humangate/
├── contracts/
│   ├── contracts/
│   │   ├── HumanGate.sol           — World ID proof verification + agent registry
│   │   ├── HumanGateResolver.sol   — ENSIP-10 wildcard resolver + text records
│   │   └── MockWorldID.sol         — Mock for testing
│   ├── scripts/
│   │   ├── deploy.ts               — Full deploy (HumanGate + Resolver)
│   │   └── upgrade-resolver.ts     — Resolver-only redeploy
│   └── test/
│       └── HumanGate.test.ts       — 11 tests
│
├── app/                             — Next.js 14 application
│   └── app/
│       ├── page.tsx                 — Landing page
│       ├── demo/page.tsx            — CAPTCHA-like faucet demo
│       ├── widget/page.tsx          — Verification widget (IDKit v4)
│       ├── dashboard/page.tsx       — Agent lookup dashboard
│       └── api/
│           ├── verify/route.ts      — Full verification pipeline
│           ├── check-pass/route.ts  — EIP-712 pass validation
│           └── rp-signature/route.ts
│
├── sdk/
│   └── index.ts                     — TypeScript SDK (verifyPass, isAgentVerified, etc.)
│
├── demo/
│   ├── agent.ts                     — Headless agent verification
│   └── faucet-demo.ts              — Terminal demo for judges
│
└── .env.example
```

## Tests

```
  HumanGate
    ✔ deploys with correct external nullifier hash
    ✔ verifies an agent and emits AgentVerified
    ✔ reverts on duplicate nullifier

  HumanGateResolver
    ✔ registers a verified agent and resolves its ENS name
    ✔ reverts registerAgent for unverified agent
    ✔ supports ExtendedResolver and ITextResolver interfaces (ENSIP-10)
    ✔ sets default text records on registration
    ✔ stores verifiedAt timestamp on registration
    ✔ allows setting custom text records for verified agents
    ✔ reverts setText for unverified agent
    ✔ resolves text records via ENSIP-10 wildcard

  11 passing (453ms)
```

## Getting Started

### Prerequisites

- Node.js 18+
- World App with Orb verification (for live verification)

### Install & Test

```bash
# 1. Clone
git clone https://github.com/davidrodr1guez/humangate.git
cd humangate

# 2. Install & test contracts
cd contracts && npm install && npm test

# 3. Run the app
cd ../app && npm install && npm run dev

# 4. Open in browser
open http://localhost:3000/demo     # CAPTCHA-like demo
open http://localhost:3000/widget   # Verification flow
open http://localhost:3000/dashboard # Agent lookup
```

### Environment Variables

Copy `.env.example` to `app/.env`:

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_APP_ID` | [World Developer Portal](https://developer.worldcoin.org) |
| `WLD_RP_ID` | World Developer Portal |
| `WLD_SIGNING_KEY` | World Developer Portal |
| `PRIVATE_KEY` | Deployer wallet private key |
| `JWT_SECRET` | Any random string |
| `WORLD_CHAIN_RPC` | Default: `https://worldchain-mainnet.g.alchemy.com/public` |

### Deploy Contracts

```bash
cd contracts
PRIVATE_KEY=0x... NEXT_PUBLIC_APP_ID=app_... npm run deploy
```

## Tracks

### World — Best use of Agent Kit ($8,000)

HumanGate extends the Agent Kit model: agents are registered with World ID delegation, receive portable EIP-712 passes, and operate autonomously. Any service integrates with one function call (`verifyPass()`). The agent never needs the human again after initial verification.

### World — Best use of World ID 4.0 ($8,000)

World ID is the root of trust. The ZK proof (Orb verification level) is verified on-chain via the WorldID Router on World Chain mainnet. One human = one nullifier = sybil-resistant. Backend verification of proofs is implemented as required. IDKit v4 with `IDKitRequestWidget` and `orbLegacy` preset.

### ENS — Best ENS Integration for AI Agents ($5,000)

- **ENSIP-10 wildcard resolver** — `{address}.humanbacked.eth` resolves dynamically without individual on-chain name registration
- **Text records** — 6 default metadata fields populated automatically on verification
- **ENSIP-25 verification loop** — Bidirectional attestation between agent (HumanGate contract) and ENS name (text records pointing back to contract)
- **ITextResolver interface** — Standard-compliant text record resolution via `resolve()`
- **Custom text records** — Agents can set additional metadata (url, avatar, skills, protocols)
- **Wildcard text resolution** — Both `addr()` and `text()` resolve through ENSIP-10

## API Reference

### POST `/api/verify`
Full verification pipeline: on-chain proof + ENS registration + EIP-712 pass.

```json
// Request
{
  "proof": { "merkle_root": "0x...", "nullifier_hash": "0x...", "proof": "0x..." },
  "agentId": "0x..."
}

// Response
{
  "verified": true,
  "txHash": "0x...",
  "ensName": "0x1234...abcd.humanbacked.eth",
  "sessionToken": "eyJ...",
  "pass": {
    "agent": "0x...", "nullifier": "0x...",
    "issuedAt": 1712188800, "expiresAt": 1712275200,
    "signature": "0x...", "signer": "0x..."
  }
}
```

### POST `/api/check-pass`
Verify an EIP-712 pass. No gas, no RPC — pure signature verification.

```json
// Request
{ "pass": { "agent": "0x...", "nullifier": "0x...", "issuedAt": 123, "expiresAt": 456, "signature": "0x...", "signer": "0x..." } }

// Response
{ "valid": true, "agent": "0x...", "ensName": "0x...humanbacked.eth" }
```

## Key Insight

> Every service shouldn't have to build its own bot detection.
> HumanGate is a **shared whitelist** — verify once, access everywhere.
> The human signs. The agent operates. The gateway protects.

---

<p align="center">
  Built at <a href="https://ethglobal.com/events/cannes2026">ETHGlobal Cannes 2026</a>
</p>
