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
    name: "registerVerified",
    inputs: [
      { name: "agent", type: "address" },
      { name: "nullifierHash", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  { type: "error", name: "AlreadyVerified", inputs: [] },
  { type: "error", name: "NotOperator", inputs: [] },
] as const;

const resolverAbi = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [
      { name: "agent", type: "address" },
      { name: "label", type: "string" },
    ],
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
    const body = await request.json();
    const { proof, agentId, idkitPayload, agentLabel } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: "Missing agentId" },
        { status: 400 }
      );
    }

    const contractAddress = process.env.HUMANGATE_CONTRACT_ADDRESS as Hex;
    const resolverAddress = process.env.HUMANGATE_RESOLVER_ADDRESS as Hex | undefined;
    const privateKey = process.env.PRIVATE_KEY as Hex;
    const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
    const rpcUrl = process.env.WORLD_CHAIN_RPC;
    const rpId = process.env.WLD_RP_ID;

    if (!contractAddress || !privateKey) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // ---------- Step 1: Verify proof via World ID Cloud API ----------
    let nullifierHash: string;

    if (idkitPayload) {
      // Forward IDKit v4 payload as-is to the cloud verification endpoint
      // Use staging domain when the proof was generated in staging environment (simulator)
      const isStaging = idkitPayload.environment === "staging";
      const verifyDomain = isStaging
        ? "https://staging-developer.worldcoin.org"
        : "https://developer.world.org";
      console.log(`Verifying via Cloud API (v4) [${isStaging ? "staging" : "production"}]...`);
      const cloudRes = await fetch(`${verifyDomain}/api/v4/verify/${rpId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idkitPayload),
      });

      if (!cloudRes.ok) {
        const err = await cloudRes.json().catch(() => ({}));
        console.error("Cloud verification failed:", err);
        return NextResponse.json(
          { error: "World ID verification failed", details: err },
          { status: 400 }
        );
      }

      const cloudData = await cloudRes.json();
      console.log("Cloud verification OK:", JSON.stringify(cloudData).slice(0, 200));

      // Extract nullifier from the v4 response
      const response = idkitPayload.responses?.[0];
      nullifierHash = response?.nullifier ?? "0x0";

    } else if (proof) {
      // Legacy flow: extract nullifier from proof object
      console.log("Using legacy proof format...");
      nullifierHash = proof.nullifier_hash;
    } else {
      return NextResponse.json(
        { error: "Missing proof or idkitPayload" },
        { status: 400 }
      );
    }

    // ---------- Step 2: Register agent on-chain ----------
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

    // Check if agent is already verified on-chain before sending tx
    let alreadyOnChain = false;
    let txHash: Hex | undefined;
    try {
      // @ts-ignore
      alreadyOnChain = await pub.readContract({
        address: contractAddress,
        abi: gateAbi,
        functionName: "isVerified",
        args: [agentId as Hex],
      });
    } catch {}

    if (alreadyOnChain) {
      console.log("Agent already verified on-chain, skipping registerVerified");
    } else {
      console.log("Registering agent on-chain via registerVerified...");
      try {
        // @ts-ignore
        txHash = await wallet.writeContract({
          account,
          chain: worldChain,
          address: contractAddress,
          abi: gateAbi,
          functionName: "registerVerified",
          args: [
            agentId as Hex,
            BigInt(nullifierHash),
          ],
        });
        await pub.waitForTransactionReceipt({ hash: txHash });
        console.log("Agent registered on-chain:", txHash);
      } catch (txErr: any) {
        const msg = txErr?.message ?? "";
        if (msg.includes("AlreadyVerified") || msg.includes("0x118fd7b8")) {
          return NextResponse.json(
            { error: "This World ID proof was already used. Each person can only verify one agent.", code: "ALREADY_VERIFIED" },
            { status: 409 }
          );
        } else if (msg.includes("NotOperator") || msg.includes("0x7c214f04")) {
          return NextResponse.json(
            { error: "Server operator mismatch. Please contact support.", code: "NOT_OPERATOR" },
            { status: 403 }
          );
        } else {
          throw txErr;
        }
      }
    }

    // ---------- Step 3: Register ENS subname ----------
    const label = agentLabel || (agentId as string).slice(2, 10).toLowerCase();
    let ensName: string | null = `${label}.humanbacked.eth`;
    if (resolverAddress) {
      // Fire and don't await receipt — avoid Vercel function timeout
      // The tx will still land on-chain even if the function returns first
      try {
        // @ts-ignore
        wallet.writeContract({
          account,
          chain: worldChain,
          address: resolverAddress,
          abi: resolverAbi,
          functionName: "registerAgent",
          args: [agentId as Hex, label],
        }).then((ensTx: Hex) => {
          console.log("ENS tx sent:", ensTx);
          pub.waitForTransactionReceipt({ hash: ensTx }).then(() => {
            console.log("ENS registered:", label + ".humanbacked.eth");
          }).catch(() => {});
        }).catch((err: any) => {
          console.warn("ENS registration failed:", err?.message?.slice(0, 100));
        });
      } catch (err) {
        console.warn("ENS registration failed (non-fatal):", err);
      }
    }

    // ---------- Step 4: Sign EIP-712 pass ----------
    const issuedAt = BigInt(Math.floor(Date.now() / 1000));
    const expiresAt = issuedAt + BigInt(24 * 60 * 60);

    const signature = await account.signTypedData({
      domain: getPassDomain(contractAddress),
      types: PASS_TYPES,
      primaryType: "HumanGatePass",
      message: {
        agent: agentId as Hex,
        nullifier: BigInt(nullifierHash),
        issuedAt,
        expiresAt,
      },
    });

    // ---------- Step 5: Mint session JWT ----------
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
        nullifier: nullifierHash,
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
