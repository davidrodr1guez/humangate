import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";

// ---------- World Chain definition ----------
export const worldChain: Chain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
};

// ---------- ABI (only the functions we need) ----------
export const HUMANGATE_ABI = [
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
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AgentVerified",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "nullifierHash", type: "uint256", indexed: false },
    ],
  },
] as const;

// ---------- EIP-712 Pass Types ----------

export const PASS_TYPES = {
  HumanGatePass: [
    { name: "agent", type: "address" },
    { name: "nullifier", type: "uint256" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

export function getPassDomain(contractAddress: Address) {
  return {
    name: "HumanGate",
    version: "1",
    chainId: 480,
    verifyingContract: contractAddress,
  } as const;
}

export interface HumanGatePass {
  agent: Address;
  nullifier: string;
  issuedAt: number;
  expiresAt: number;
  signature: Hex;
  signer: Address;
}

// ---------- Client helpers ----------

export function getPublicClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: worldChain,
    transport: http(rpcUrl),
  });
}

export function getWalletClient(
  privateKey: Hex,
  rpcUrl?: string
): WalletClient {
  const { privateKeyToAccount } = require("viem/accounts") as typeof import("viem/accounts");
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: worldChain,
    transport: http(rpcUrl),
  });
}

// ---------- Contract read ----------

export async function isAgentVerified(
  contractAddress: Address,
  agent: Address,
  rpcUrl?: string
): Promise<boolean> {
  const client = getPublicClient(rpcUrl);
  return client.readContract({
    address: contractAddress,
    abi: HUMANGATE_ABI,
    functionName: "isVerified",
    args: [agent],
  }) as Promise<boolean>;
}

// ---------- Contract write ----------

export interface VerifyAgentParams {
  contractAddress: Address;
  agent: Address;
  root: bigint;
  nullifierHash: bigint;
  proof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  privateKey: Hex;
  rpcUrl?: string;
}

export async function verifyAgentOnChain(params: VerifyAgentParams): Promise<Hex> {
  const wallet = getWalletClient(params.privateKey, params.rpcUrl);
  const pub = getPublicClient(params.rpcUrl);

  const hash = await wallet.writeContract({
    address: params.contractAddress,
    abi: HUMANGATE_ABI,
    functionName: "verifyAgent",
    args: [params.agent, params.root, params.nullifierHash, [...params.proof]],
  });

  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

// ---------- Pass verification (fully local — no API, no RPC, no gas) ----------

/**
 * Verify a HumanGate pass locally using ecrecover.
 * This is the function any service calls to check if an agent is human-backed.
 * Zero network calls. Pure cryptography.
 */
export async function verifyPass(
  pass: HumanGatePass,
  contractAddress: Address
): Promise<{ valid: boolean; reason?: string }> {
  // 1. Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > pass.expiresAt) {
    return { valid: false, reason: "Pass expired" };
  }

  // 2. Verify EIP-712 signature
  const { verifyTypedData } = require("viem") as typeof import("viem");

  const valid = await verifyTypedData({
    address: pass.signer,
    domain: getPassDomain(contractAddress),
    types: PASS_TYPES,
    primaryType: "HumanGatePass",
    message: {
      agent: pass.agent,
      nullifier: BigInt(pass.nullifier),
      issuedAt: BigInt(pass.issuedAt),
      expiresAt: BigInt(pass.expiresAt),
    },
    signature: pass.signature,
  });

  if (!valid) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}

// ---------- Challenge-response authentication ----------

/**
 * Authenticate an agent with a HumanGate-protected service.
 * The agent signs a challenge to prove wallet ownership,
 * then the service checks isVerified() on-chain.
 *
 * This is how an agent "passes the CAPTCHA" autonomously.
 */
export async function authenticateAgent(
  gatewayUrl: string,
  privateKey: Hex
): Promise<{ authenticated: boolean; humanBacked: boolean; agent: string }> {
  const { privateKeyToAccount } = require("viem/accounts") as typeof import("viem/accounts");
  const account = privateKeyToAccount(privateKey);

  // 1. Get challenge
  const challengeRes = await fetch(`${gatewayUrl}/api/challenge?agent=${account.address}`);
  const { nonce, message } = await challengeRes.json();

  // 2. Sign it
  const signature = await account.signMessage({ message });

  // 3. Submit
  const authRes = await fetch(`${gatewayUrl}/api/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent: account.address, nonce, signature }),
  });

  return authRes.json();
}

// ---------- Proof decoding helper ----------

export function decodeProof(proofHex: Hex): readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] {
  const { decodeAbiParameters } = require("viem") as typeof import("viem");
  const decoded = decodeAbiParameters(
    [{ type: "uint256[8]" }],
    proofHex
  );
  return decoded[0] as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}
