import { NextResponse } from "next/server";
import { createPublicClient, http, type Hex, type Address } from "viem";
import { randomBytes } from "crypto";

const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] } },
} as const;

// Store challenges in memory (production: use Redis/DB)
const challenges = new Map<string, { nonce: string; expiresAt: number }>();

/**
 * GET /api/challenge?agent=0x...
 * Returns a random nonce the agent must sign to prove identity.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const agent = url.searchParams.get("agent");

  if (!agent) {
    return NextResponse.json({ error: "Missing agent parameter" }, { status: 400 });
  }

  const nonce = "0x" + randomBytes(32).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min

  challenges.set(agent.toLowerCase(), { nonce, expiresAt });

  return NextResponse.json({
    nonce,
    message: `HumanGate challenge: sign this nonce to prove you are ${agent}`,
    expiresAt,
  });
}

/**
 * POST /api/challenge
 * Agent submits the signed nonce. Backend verifies:
 * 1. Signature matches the agent's wallet (proves identity)
 * 2. Agent is in the HumanGate whitelist (proves human-backed)
 */
export async function POST(request: Request) {
  try {
    const { agent, nonce, signature } = await request.json();

    if (!agent || !nonce || !signature) {
      return NextResponse.json({ error: "Missing agent, nonce, or signature" }, { status: 400 });
    }

    // 1. Check challenge exists and hasn't expired
    const stored = challenges.get(agent.toLowerCase());
    if (!stored || stored.nonce !== nonce) {
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > stored.expiresAt) {
      challenges.delete(agent.toLowerCase());
      return NextResponse.json({ error: "Challenge expired" }, { status: 401 });
    }

    // Clean up used challenge
    challenges.delete(agent.toLowerCase());

    // 2. Verify signature — proves the agent owns this wallet
    const { verifyMessage } = await import("viem");
    const message = `HumanGate challenge: sign this nonce to prove you are ${agent}`;

    const valid = await verifyMessage({
      address: agent as Address,
      message,
      signature: signature as Hex,
    });

    if (!valid) {
      return NextResponse.json({
        authenticated: false,
        reason: "Invalid signature — you are not the owner of this wallet",
      }, { status: 401 });
    }

    // 3. Check on-chain whitelist — proves human-backed
    const contractAddress = process.env.HUMANGATE_CONTRACT_ADDRESS as Hex;
    if (!contractAddress) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const client = createPublicClient({ chain: worldChain, transport: http() });

    // @ts-ignore
    const verified = await client.readContract({
      address: contractAddress,
      abi: [{
        type: "function", name: "isVerified",
        inputs: [{ name: "agent", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
      }],
      functionName: "isVerified",
      args: [agent as Address],
    });

    if (!verified) {
      return NextResponse.json({
        authenticated: true,
        humanBacked: false,
        reason: "Wallet is valid but agent is not in the HumanGate whitelist",
      }, { status: 403 });
    }

    // 4. Both checks pass — agent is who they say AND human-backed
    return NextResponse.json({
      authenticated: true,
      humanBacked: true,
      agent,
      message: "Agent is authenticated and human-backed",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
