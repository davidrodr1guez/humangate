import { NextResponse } from "next/server";
import { type Hex } from "viem";

// ---------- EIP-712 Pass Types (must match /api/verify) ----------
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
    const { pass } = await request.json();

    if (!pass?.agent || !pass?.signature || !pass?.nullifier || !pass?.issuedAt || !pass?.expiresAt) {
      return NextResponse.json(
        { error: "Invalid pass: missing fields" },
        { status: 400 }
      );
    }

    const contractAddress = process.env.HUMANGATE_CONTRACT_ADDRESS as Hex;
    if (!contractAddress) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // 1. Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now > pass.expiresAt) {
      return NextResponse.json({
        valid: false,
        reason: "Pass expired",
      });
    }

    // 2. Recover signer from EIP-712 signature
    const { verifyTypedData } = await import("viem");

    const recoveredValid = await verifyTypedData({
      address: pass.signer as Hex,
      domain: getPassDomain(contractAddress),
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

    if (!recoveredValid) {
      return NextResponse.json({
        valid: false,
        reason: "Invalid signature",
      });
    }

    // 3. Pass is valid — agent is human-backed
    return NextResponse.json({
      valid: true,
      agent: pass.agent,
      ensName: `${(pass.agent as string).toLowerCase()}.humanbacked.eth`,
      expiresAt: pass.expiresAt,
    });
  } catch (err: any) {
    console.error("Pass check failed:", err);
    return NextResponse.json(
      { error: err.message ?? "Check failed" },
      { status: 500 }
    );
  }
}
