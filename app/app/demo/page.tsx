"use client";

import { useState } from "react";
import { createPublicClient, http, type Address } from "viem";

const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
} as const;

const gateAbi = [
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

type GateState =
  | { status: "locked" }
  | { status: "checking" }
  | { status: "unlocked"; agent: string; ensName: string }
  | { status: "rejected"; agent: string };

export default function DemoPage() {
  const [agent, setAgent] = useState("");
  const [gate, setGate] = useState<GateState>({ status: "locked" });

  const contractAddress = process.env.NEXT_PUBLIC_HUMANGATE_CONTRACT as
    | Address
    | undefined;

  async function checkGate() {
    if (!agent || !contractAddress) return;
    setGate({ status: "checking" });

    try {
      const client = createPublicClient({
        chain: worldChain,
        transport: http(),
      });

      // @ts-ignore viem type compat
      const verified = await client.readContract({
        address: contractAddress,
        abi: gateAbi,
        functionName: "isVerified",
        args: [agent as Address],
      });

      if (verified) {
        setGate({
          status: "unlocked",
          agent,
          ensName: `${agent.toLowerCase()}.humanbacked.eth`,
        });
      } else {
        setGate({ status: "rejected", agent });
      }
    } catch {
      setGate({ status: "rejected", agent });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && agent) checkGate();
  }

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
        {/* Service header */}
        <div className="text-center mb-10 opacity-0 animate-fade-in-up fill-mode-forwards">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-1.5 mb-4">
            <span className="text-xs text-white/40">Demo Service</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Token Faucet
          </h1>
          <p className="mt-2 text-sm text-white/30 max-w-sm mx-auto">
            Claim 0.1 ETH for testing. Protected by HumanGate.
          </p>
        </div>

        <div className="w-full max-w-md">
          {/* LOCKED — The gate */}
          {(gate.status === "locked" ||
            gate.status === "checking" ||
            gate.status === "rejected") && (
            <div className="opacity-0 animate-fade-in-up fill-mode-forwards delay-200">
              {/* Protected content preview (blurred) */}
              <div className="relative mb-6 rounded-2xl overflow-hidden">
                <div className="blur-sm pointer-events-none select-none p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-lg font-semibold text-white">
                      Claim Tokens
                    </span>
                    <span className="text-accent font-mono">0.1 ETH</span>
                  </div>
                  <div className="h-12 rounded-xl bg-white/[0.05] mb-4" />
                  <div className="h-12 rounded-xl bg-accent/20" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-surface-0/60 backdrop-blur-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-8 w-8 text-white/20"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="11"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 11V7a5 5 0 0110 0v4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* HumanGate challenge */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5 text-accent"
                    >
                      <path
                        d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 12l2 2 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      HumanGate Checkpoint
                    </p>
                    <p className="text-[11px] text-white/30">
                      Verify your agent is human-backed to continue
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Agent address (0x...)"
                    value={agent}
                    onChange={(e) => setAgent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="input-field font-mono text-sm"
                  />

                  <button
                    onClick={checkGate}
                    disabled={!agent || gate.status === "checking"}
                    className="btn-primary w-full py-3.5 text-sm disabled:opacity-40"
                  >
                    {gate.status === "checking" ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        <span>Checking on-chain...</span>
                      </div>
                    ) : (
                      "Verify agent"
                    )}
                  </button>

                  {gate.status === "rejected" && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
                      <div className="flex items-start gap-3">
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          className="h-4 w-4 text-red-400 mt-0.5 shrink-0"
                        >
                          <circle
                            cx="8"
                            cy="8"
                            r="6.5"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M6 6l4 4M10 6l-4 4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div>
                          <p className="text-sm text-red-400 font-medium">
                            Agent not verified
                          </p>
                          <p className="text-xs text-white/30 mt-1">
                            This agent has not been verified through HumanGate.
                            Go to{" "}
                            <a
                              href="/widget"
                              className="text-accent underline underline-offset-2"
                            >
                              /verify
                            </a>{" "}
                            to register your agent first.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center justify-center gap-1.5">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3 w-3 text-white/15"
                  >
                    <path
                      d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-[10px] text-white/15">
                    Protected by HumanGate + World ID
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* UNLOCKED — Content revealed */}
          {gate.status === "unlocked" && (
            <div className="animate-scale-in">
              {/* Verified badge */}
              <div className="flex justify-center mb-6">
                <div className="badge-verified gap-2 px-4 py-2">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <path
                      d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5.5 8l2 2 3-3"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Human-backed agent verified
                </div>
              </div>

              {/* Unlocked content */}
              <div className="glass-card p-8 glow-accent-sm">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-semibold text-white">
                    Claim Tokens
                  </span>
                  <span className="text-accent font-mono font-semibold">
                    0.1 ETH
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                    Receiving Agent
                  </p>
                  <p className="font-mono text-sm text-white/70">
                    {gate.agent.slice(0, 10)}...{gate.agent.slice(-8)}
                  </p>
                  <p className="font-mono text-xs text-accent/60 mt-1">
                    {gate.ensName}
                  </p>
                </div>

                <button className="btn-primary w-full py-4 text-sm">
                  Claim 0.1 ETH
                </button>

                <p className="text-center text-[11px] text-white/20 mt-4">
                  No CAPTCHA needed. Your agent passed the gate.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
