import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const signingKey = process.env.WLD_SIGNING_KEY;
  const rpId = process.env.WLD_RP_ID;

  if (!signingKey || !rpId) {
    return NextResponse.json(
      { error: "RP signing not configured" },
      { status: 503 }
    );
  }

  try {
    const { action } = await request.json();

    // Use IDKit's built-in signing utility
    // @ts-ignore — module resolution handled by bundler
    const { signRequest } = await import("@worldcoin/idkit/signing");
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: signingKey,
      action,
    });

    return NextResponse.json({
      rp_id: rpId,
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (err: any) {
    console.error("RP signature error:", err);
    return NextResponse.json(
      { error: err.message ?? "Signing failed" },
      { status: 500 }
    );
  }
}
