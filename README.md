# HumanGate

> The CAPTCHA for Human-Backed AI Agents

HumanGate is a verification protocol that lets AI agents prove they are authorized by a real human — using World ID zero-knowledge proofs — so they can pass CAPTCHA-protected services autonomously, without human intervention.

## The Problem

Today's internet blocks all agents equally. Faucets, testnets, and dapps use CAPTCHAs to stop bots — but also block legitimate agents acting on behalf of real people. Developers have to babysit their agents every time a CAPTCHA appears.

## The Solution

Instead of "prove you're human," HumanGate asks **"prove your agent is human-backed."** A World ID-verified agent can pass challenges autonomously — claiming faucet tokens, interacting with dapps — without the human owner ever intervening.

## How It Works

```
┌─────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────┐
│  Agent   │────>│  HumanGate   │────>│  World ID  │────>│   ENS    │
│ arrives  │     │  challenge   │     │  ZK proof  │     │ identity │
└─────────┘     └──────────────┘     └────────────┘     └──────────┘
```

1. Agent arrives at a HumanGate-protected service
2. Service presents a HumanGate challenge
3. Agent generates a ZK proof via World Agent Kit
4. Proof is verified on-chain (no identity revealed)
5. Agent passes + receives an ENS identity (`agent.humanbacked.eth`)

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Identity | **World Agent Kit** | Agent authorization by verified humans |
| Proof | **World ID 4.0** | ZK proof of personhood (1 human = 1 agent) |
| Naming | **ENS** | Persistent human-readable identity for verified agents |
| Frontend | **Next.js 14** | Widget + dashboard + API |
| Contracts | **Solidity / Hardhat** | On-chain verification on World Chain Sepolia |

## Project Structure

```
contracts/   → HumanGate.sol (on-chain verification) + tests (3/3 passing)
sdk/         → TypeScript SDK for service integrations
app/         → Next.js 14 (embeddable widget + dashboard + verify API)
demo/        → Headless agent verification demo
```

## Getting Started

```bash
# 1. Install & test contracts
cd contracts && npm install && npm test

# 2. Run the app
cd app && npm install && npm run dev

# 3. Deploy to World Chain Sepolia
cd contracts && npm run deploy:sepolia

# 4. Run the demo agent
cd demo && npm install && AGENT_ADDRESS=0x... npx tsx agent.ts
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_APP_ID` | [World Developer Portal](https://developer.world.org) |
| `WLD_RP_ID` | World Developer Portal |
| `WLD_SIGNING_KEY` | World Developer Portal |
| `PRIVATE_KEY` | Deployer wallet private key |
| `JWT_SECRET` | Any random secret |

## Architecture

```
User (World App)
  │
  ▼
Widget (/widget) ──── IDKit v4 ──── World ID ZK Proof
  │
  ▼
API (/api/verify) ──── viem ──── HumanGate.sol (World Chain Sepolia)
  │                                    │
  ├── JWT session token                ├── verifyProof() via WorldID Router
  └── ENS subname registration         └── emit AgentVerified(agent, nullifier)
```

## Tracks

- **World — Best use of Agent Kit** ($8,000) — Distinguishes human-backed agents from bots
- **World — Best use of World ID 4.0** ($8,000) — ZK proof as a real constraint for agent access
- **ENS — Best ENS Integration for AI Agents** ($5,000) — Persistent on-chain identity for verified agents

## License

MIT
