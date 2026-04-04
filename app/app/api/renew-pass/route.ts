import { NextResponse } from "next/server";
import { createPublicClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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
 * POST /api/renew-pass
 *
 * Agent requests a fresh pass WITHOUT human intervention.
 * Backend checks on-chain that the agent is still verified,
 * then signs a new 24h pass.
 *
 * Body: { agent: "0x..." }
 */
export async function POST(request: Request) {
  try {
    const { agent } = await request.json();
    if (!agent) {
      return NextResponse.json({ error: "Missing agent address" }, { status: 400 });
    }

    const contractAddress = process.env.HUMANGATE_CONTRACT_ADDRESS as Hex;
    const privateKey = process.env.PRIVATE_KEY as Hex;
    if (!contractAddress || !privateKey) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Check on-chain that agent is still verified
    const client = createPublicClient({ chain: worldChain, transport: http() });

    // @ts-ignore
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
      args: [agent as Address],
    });

    if (!verified) {
      return NextResponse.json({ error: "Agent not verified on-chain" }, { status: 403 });
    }

    // Sign fresh pass
    const account = privateKeyToAccount(privateKey);
    const issuedAt = BigInt(Math.floor(Date.now() / 1000));
    const expiresAt = issuedAt + BigInt(24 * 60 * 60);

    const signature = await account.signTypedData({
      domain: {
        name: "HumanGate",
        version: "1",
        chainId: 480,
        verifyingContract: contractAddress,
      },
      types: PASS_TYPES,
      primaryType: "HumanGatePass",
      message: {
        agent: agent as Hex,
        nullifier: 0n,
        issuedAt,
        expiresAt,
      },
    });

    return NextResponse.json({
      pass: {
        agent,
        nullifier: "0x0",
        issuedAt: Number(issuedAt),
        expiresAt: Number(expiresAt),
        signature,
        signer: account.address,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
