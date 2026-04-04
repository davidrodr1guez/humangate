import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SignJWT } from "jose";

// ---------- Chain ----------
const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
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

// ---------- EIP-712 Pass Types ----------
const PASS_TYPES = {
  HumanGatePass: [
    { name: "agent", type: "address" },
    { name: "nullifier", type: "uint256" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

function getPassDomain(contractAddress: Hex) {
  return {
    name: "HumanGate",
    version: "1",
    chainId: 480,
    verifyingContract: contractAddress,
  } as const;
}

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
    const rpcUrl = process.env.WORLD_CHAIN_RPC;

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
      chain: worldChain,
      transport: http(rpcUrl),
    });
    const pub = createPublicClient({
      chain: worldChain,
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

    // 3. Sign EIP-712 HumanGate Pass
    const issuedAt = BigInt(Math.floor(Date.now() / 1000));
    const expiresAt = issuedAt + BigInt(24 * 60 * 60); // 24h

    const passData = {
      agent: agentId as Hex,
      nullifier: BigInt(proof.nullifier_hash),
      issuedAt,
      expiresAt,
    };

    const signature = await account.signTypedData({
      domain: getPassDomain(contractAddress),
      types: PASS_TYPES,
      primaryType: "HumanGatePass",
      message: passData,
    });

    // 4. Mint session JWT (backward-compatible)
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
      pass: {
        agent: agentId,
        nullifier: proof.nullifier_hash,
        issuedAt: Number(issuedAt),
        expiresAt: Number(expiresAt),
        signature,
        signer: account.address,
      },
    });
  } catch (err: any) {
    console.error("Verification failed:", err);
    return NextResponse.json(
      { error: err.message ?? "Verification failed" },
      { status: 500 }
    );
  }
}
