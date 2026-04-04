import { NextResponse } from "next/server";

export async function POST() {
  const { privateKeyToAccount } = await import("viem/accounts");
  const { randomBytes } = await import("crypto");

  const privateKey = ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  return NextResponse.json({
    address: account.address,
    privateKey,
  });
}
