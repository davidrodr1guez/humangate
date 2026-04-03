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

// ---------- ABIs ----------
const gateAbi = [
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

const resolverAbi = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// ---------- Handler ----------
export async function POST(request: Request) {
  try {
    const { proof, agentId } = await request.json();

    if (!proof || !agentId) {
      return NextResponse.json(
        { error: "Missing proof or agentId" },
        { status: 400 }
      );
    }

    const contractAddress = process.env.HUMANGATE_CONTRACT_ADDRESS as Hex;
    const resolverAddress = process.env.HUMANGATE_RESOLVER_ADDRESS as Hex | undefined;
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

    // Set up clients
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

    // 1. Verify agent on-chain via HumanGate
    const txHash = await wallet.writeContract({
      address: contractAddress,
      abi: gateAbi,
      functionName: "verifyAgent",
      args: [
        agentId as Hex,
        BigInt(proof.merkle_root),
        BigInt(proof.nullifier_hash),
        proofArray as any,
      ],
    });

    await pub.waitForTransactionReceipt({ hash: txHash });

    // 2. Register ENS subname via HumanGateResolver
    let ensName: string | null = null;
    if (resolverAddress) {
      try {
        const ensTx = await wallet.writeContract({
          address: resolverAddress,
          abi: resolverAbi,
          functionName: "registerAgent",
          args: [agentId as Hex],
        });
        await pub.waitForTransactionReceipt({ hash: ensTx });
        ensName = `${(agentId as string).toLowerCase()}.humanbacked.eth`;
      } catch (err) {
        console.warn("ENS registration failed (non-fatal):", err);
        ensName = `${(agentId as string).toLowerCase()}.humanbacked.eth`;
      }
    } else {
      ensName = `${(agentId as string).toLowerCase()}.humanbacked.eth`;
    }

    // 3. Mint session JWT
    const secret = new TextEncoder().encode(jwtSecret);
    const sessionToken = await new SignJWT({
      sub: agentId,
      verified: true,
      ensName,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    return NextResponse.json({
      verified: true,
      sessionToken,
      txHash,
      ensName,
    });
  } catch (err: any) {
    console.error("Verification failed:", err);
    return NextResponse.json(
      { error: err.message ?? "Verification failed" },
      { status: 500 }
    );
  }
}
