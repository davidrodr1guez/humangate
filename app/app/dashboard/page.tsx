"use client";

import { useState } from "react";
import { createPublicClient, http, type Address } from "viem";

const worldChainSepolia = {
  id: 4801,
  name: "World Chain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-sepolia.g.alchemy.com/public"] },
  },
  testnet: true,
} as const;

const abi = [
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

type CheckResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "result"; verified: boolean; agent: string }
  | { status: "error"; message: string };

export default function DashboardPage() {
  const [agent, setAgent] = useState("");
  const [result, setResult] = useState<CheckResult>({ status: "idle" });

  const contractAddress = process.env.NEXT_PUBLIC_HUMANGATE_CONTRACT as Address | undefined;

  async function checkAgent() {
    if (!contractAddress) {
      setResult({ status: "error", message: "Contract address not configured" });
      return;
    }
    setResult({ status: "loading" });

    try {
      const client = createPublicClient({
        chain: worldChainSepolia,
        transport: http(),
      });

      const verified = await client.readContract({
        address: contractAddress,
        abi,
        functionName: "isVerified",
        args: [agent as Address],
      });

      setResult({ status: "result", verified, agent });
    } catch (err: any) {
      setResult({ status: "error", message: err.message });
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 gap-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Agent Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Check if an agent is human-verified on-chain.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Agent address (0x...)"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
          />
          <button
            onClick={checkAgent}
            disabled={!agent || result.status === "loading"}
            className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50"
          >
            Check
          </button>
        </div>

        {result.status === "result" && (
          <div
            className={`p-4 rounded-lg border ${
              result.verified
                ? "bg-green-900/30 border-green-700"
                : "bg-yellow-900/30 border-yellow-700"
            }`}
          >
            <p className="text-sm font-mono break-all mb-2">{result.agent}</p>
            <p className={result.verified ? "text-green-400" : "text-yellow-400"}>
              {result.verified ? "Verified human-backed agent" : "Not verified"}
            </p>
          </div>
        )}

        {result.status === "error" && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-400 text-sm">{result.message}</p>
          </div>
        )}
      </div>
    </main>
  );
}
