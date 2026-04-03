import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SignJWT } from "jose";

// ---------- Chain ----------
const worldChainSepolia = {
  id: 4801,
  name: "World Chain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-sepolia.g.alchemy.com/public"] },
  },
  testnet: true,
} as const;

// ---------- ABI (minimal) ----------
const abi = [
  {
    type: "function",
    name: "verifyAgent",
    inputs: [
      { name: "agent", type: "address" },
      { name: "root", type: "uint256" },
      { name: "nullifierHash", type: "uint256" },
      { name: "proof", type: "uint256[8]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// ---------- Handler ----------
export async function POST(request: Request) {
  try {
    const { proof, agentId } = await request.json();

    // Validate input
    if (!proof || !agentId) {
      return NextResponse.json(
        { error: "Missing proof or agentId" },
        { status: 400 }
      );
    }

    const contractAddress = process.env.HUMANGATE_CONTRACT_ADDRESS as Hex;
    const privateKey = process.env.PRIVATE_KEY as Hex;
    const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
    const rpcUrl = process.env.WORLD_CHAIN_SEPOLIA_RPC;

    if (!contractAddress || !privateKey) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Decode the ABI-encoded proof into uint256[8]
    const { decodeAbiParameters } = await import("viem");
    const proofArray = decodeAbiParameters(
      [{ type: "uint256[8]" }],
      proof.proof as Hex
    )[0];

    // Send tx to HumanGate contract
    const account = privateKeyToAccount(privateKey);
    const wallet = createWalletClient({
      account,
      chain: worldChainSepolia,
      transport: http(rpcUrl),
    });
    const pub = createPublicClient({
      chain: worldChainSepolia,
      transport: http(rpcUrl),
    });

    const txHash = await wallet.writeContract({
      address: contractAddress,
      abi,
      functionName: "verifyAgent",
      args: [
        agentId as Hex,
        BigInt(proof.merkle_root),
        BigInt(proof.nullifier_hash),
        proofArray as any,
      ],
    });

    await pub.waitForTransactionReceipt({ hash: txHash });

    // Mint a session JWT
    const secret = new TextEncoder().encode(jwtSecret);
    const sessionToken = await new SignJWT({
      sub: agentId,
      verified: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    return NextResponse.json({
      verified: true,
      sessionToken,
      txHash,
    });
  } catch (err: any) {
    console.error("Verification failed:", err);
    return NextResponse.json(
      { error: err.message ?? "Verification failed" },
      { status: 500 }
    );
  }
}
