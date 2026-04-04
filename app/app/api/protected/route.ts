import { NextResponse } from "next/server";
import { createPublicClient, http, type Hex, type Address } from "viem";

const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
} as const;

const PASS_TYPES = {
  HumanGatePass: [
    { name: "agent", type: "address" },
    { name: "nullifier", type: "uint256" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

/**
 * GET /api/protected
 *
 * Example protected endpoint. Requires either:
 *   - Authorization: Bearer <pass JSON base64>
 *   - ?agent=0x... (checks on-chain whitelist)
 */
export async function GET(request: Request) {
  const contractAddress = process.env.HUMANGATE_CONTRACT_ADDRESS as Hex;
  if (!contractAddress) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Method 1: EIP-712 pass in Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const passJson = Buffer.from(authHeader.slice(7), "base64").toString();
      const pass = JSON.parse(passJson);

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (now > pass.expiresAt) {
        return NextResponse.json({ error: "Pass expired" }, { status: 401 });
      }

      // Verify signature
      const { verifyTypedData } = await import("viem");
      const valid = await verifyTypedData({
        address: pass.signer as Hex,
        domain: {
          name: "HumanGate",
          version: "1",
          chainId: 480,
          verifyingContract: contractAddress,
        },
        types: PASS_TYPES,
        primaryType: "HumanGatePass",
        message: {
          agent: pass.agent as Hex,
          nullifier: BigInt(pass.nullifier),
          issuedAt: BigInt(pass.issuedAt),
          expiresAt: BigInt(pass.expiresAt),
        },
        signature: pass.signature as Hex,
      });

      if (!valid) {
        return NextResponse.json({ error: "Invalid pass signature" }, { status: 401 });
      }

      return NextResponse.json({
        access: "granted",
        method: "eip712-pass",
        agent: pass.agent,
        ensName: `${(pass.agent as string).toLowerCase()}.humanbacked.eth`,
        data: {
          message: "Welcome, human-backed agent. Here is your protected data.",
          balance: "0.1 ETH",
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      return NextResponse.json({ error: "Invalid pass format" }, { status: 401 });
    }
  }

  // Method 2: On-chain check via ?agent=0x...
  const url = new URL(request.url);
  const agent = url.searchParams.get("agent") as Address | null;

  if (!agent) {
    return NextResponse.json({
      error: "Authentication required",
      methods: [
        "Authorization: Bearer <base64-encoded pass JSON>",
        "?agent=0x... (on-chain whitelist check)",
      ],
    }, { status: 401 });
  }

  try {
    const client = createPublicClient({
      chain: worldChain,
      transport: http(),
    });

    // @ts-ignore viem type compat
    const verified = await client.readContract({
      address: contractAddress,
      abi: [{
        type: "function",
        name: "isVerified",
        inputs: [{ name: "agent", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
      }],
      functionName: "isVerified",
      args: [agent],
    });

    if (!verified) {
      return NextResponse.json({
        access: "denied",
        agent,
        reason: "Agent not in HumanGate whitelist",
        verify: "/widget",
      }, { status: 403 });
    }

    return NextResponse.json({
      access: "granted",
      method: "on-chain-whitelist",
      agent,
      ensName: `${agent.toLowerCase()}.humanbacked.eth`,
      data: {
        message: "Welcome, human-backed agent. Here is your protected data.",
        balance: "0.1 ETH",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
