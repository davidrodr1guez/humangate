"use client";

import { useState } from "react";
import Link from "next/link";
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

const resolverAbi = [
  {
    type: "function",
    name: "ensNameOf",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

type GateState =
  | { step: "gate" }
  | { step: "checking" }
  | { step: "blocked"; agent: string }
  | { step: "passed"; agent: string; ensName: string };

export default function Home() {
  const [agent, setAgent] = useState("");
  const [state, setState] = useState<GateState>({ step: "gate" });

  const contractAddress = process.env.NEXT_PUBLIC_HUMANGATE_CONTRACT as Address | undefined;
  const resolverAddress = process.env.NEXT_PUBLIC_RESOLVER_CONTRACT as Address | undefined;

  async function checkGate() {
    if (!agent || !contractAddress) return;
    setState({ step: "checking" });

    try {
      const client = createPublicClient({ chain: worldChain, transport: http() });

      // @ts-ignore
      const verified = await client.readContract({
        address: contractAddress,
        abi: gateAbi,
        functionName: "isVerified",
        args: [agent as Address],
      });

      if (verified) {
        let ensName = "";
        if (resolverAddress) {
          try {
            // @ts-ignore
            ensName = await client.readContract({
              address: resolverAddress,
              abi: resolverAbi,
              functionName: "ensNameOf",
              args: [agent as Address],
            });
          } catch {}
        }
        setState({ step: "passed", agent, ensName: ensName || `${agent.slice(2, 10).toLowerCase()}.humanbacked.eth` });
      } else {
        setState({ step: "blocked", agent });
      }
    } catch {
      setState({ step: "blocked", agent });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && agent) checkGate();
  }

  // ── PASSED: Content unlocked ──
  if (state.step === "passed") {
    return (
      <main className="relative min-h-screen">
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="relative z-10 flex flex-col items-center px-4 pt-12 pb-20">
          {/* Verified banner */}
          <div className="animate-fade-in mb-8">
            <div className="badge-verified gap-2 px-5 py-2.5 text-sm">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                <path d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Human-backed agent verified
            </div>
          </div>

          <div className="animate-fade-in-up text-center mb-10 max-w-lg">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Welcome, <span className="text-gradient">{state.ensName}</span>
            </h1>
            <p className="text-sm text-white/30 font-mono">{state.agent}</p>
          </div>

          {/* Content cards */}
          <div className="w-full max-w-md space-y-4 animate-fade-in-up delay-200 fill-mode-forwards opacity-0">
            <div className="glass-card p-6 glow-accent-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-white">Token Faucet</span>
                <span className="text-accent font-mono">0.1 ETH</span>
              </div>
              <p className="text-xs text-white/30 mb-4">Your agent passed the gate. No CAPTCHA needed.</p>
              <button className="btn-primary w-full py-3 text-sm">Claim Tokens</button>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-white">Bounty Board</span>
                <span className="text-white/40 text-sm">3 active</span>
              </div>
              <p className="text-xs text-white/30 mb-4">Browse and claim bounties autonomously.</p>
              <button className="btn-secondary w-full py-3 text-sm">Browse Bounties</button>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-white">Protected API</span>
                <span className="text-white/40 text-sm">Unlimited</span>
              </div>
              <p className="text-xs text-white/30 mb-4">Access rate-limited data with your pass.</p>
              <button className="btn-secondary w-full py-3 text-sm">Get API Key</button>
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <Link href="/dashboard" className="btn-secondary px-6 py-2.5 text-xs">Dashboard</Link>
            <button onClick={() => setState({ step: "gate" })} className="btn-secondary px-6 py-2.5 text-xs">Check Another</button>
          </div>
        </div>
      </main>
    );
  }

  // ── GATE: The checkpoint ──
  return (
    <main className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 grid-pattern opacity-15" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/[0.03] rounded-full blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm px-4 py-12">
        {/* Shield icon */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 h-20 w-20 rounded-full bg-accent/10 blur-xl" />
            <svg viewBox="0 0 64 72" fill="none" className="relative h-20 w-20 animate-float">
              <path
                d="M32 4L6 18v16c0 18.5 11.1 35.8 26 40 14.9-4.2 26-21.5 26-40V18L32 4z"
                fill="rgba(16,185,129,0.08)"
                stroke="rgba(16,185,129,0.4)"
                strokeWidth="1.5"
              />
              <rect x="22" y="28" width="2" height="18" rx="1" fill="rgba(255,255,255,0.2)" />
              <rect x="27" y="24" width="2" height="22" rx="1" fill="rgba(255,255,255,0.3)" />
              <rect x="31" y="22" width="2" height="24" rx="1" fill="rgba(255,255,255,0.35)" />
              <rect x="35" y="24" width="2" height="22" rx="1" fill="rgba(255,255,255,0.3)" />
              <rect x="40" y="28" width="2" height="18" rx="1" fill="rgba(255,255,255,0.2)" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="text-xl font-bold text-white mb-1.5">HumanGate</h1>
          <p className="text-xs text-white/30">Verify your agent is human-backed to continue</p>
        </div>

        {/* Gate card */}
        <div className="glass-card p-5 animate-fade-in-up delay-200 fill-mode-forwards opacity-0">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                Agent Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="input-field font-mono text-sm"
              />
            </div>

            <button
              onClick={checkGate}
              disabled={!agent || state.step === "checking"}
              className="btn-primary w-full py-3.5 text-sm disabled:opacity-40"
            >
              {state.step === "checking" ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  Checking...
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <path d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Verify
                </>
              )}
            </button>
          </div>

          {/* Blocked state */}
          {state.step === "blocked" && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 animate-fade-in">
              <p className="text-sm text-amber-400 font-medium mb-1">Agent not verified</p>
              <p className="text-xs text-white/30 mb-3">
                This agent is not in the HumanGate whitelist.
              </p>
              <Link
                href="/widget"
                className="inline-flex items-center gap-1.5 text-xs text-accent font-medium hover:text-accent-light transition-colors"
              >
                Register your agent
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 animate-fade-in delay-300 fill-mode-forwards opacity-0">
          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-white/10">
            <path d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] text-white/10">Powered by World ID + ENS</span>
        </div>
      </div>
    </main>
  );
}
