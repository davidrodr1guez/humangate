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

// ---------- World Chain Sepolia definition ----------
export const worldChainSepolia: Chain = {
  id: 4801,
  name: "World Chain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-sepolia.g.alchemy.com/public"] },
  },
  testnet: true,
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

// ---------- Client helpers ----------

export function getPublicClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: worldChainSepolia,
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
    chain: worldChainSepolia,
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

// ---------- Proof decoding helper ----------

export function decodeProof(proofHex: Hex): readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] {
  const { decodeAbiParameters } = require("viem") as typeof import("viem");
  const decoded = decodeAbiParameters(
    [{ type: "uint256[8]" }],
    proofHex
  );
  return decoded[0] as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}
