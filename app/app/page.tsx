"use client";

import { useState, useEffect } from "react";
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
  {
    type: "function",
    name: "text",
    inputs: [
      { name: "agent", type: "address" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

interface TextRecord {
  key: string;
  value: string;
}

type GateState =
  | { step: "gate" }
  | { step: "checking" }
  | { step: "blocked"; agent: string }
  | {
      step: "passed";
      agent: string;
      ensName: string;
      records: TextRecord[];
    };

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

      if (verified && resolverAddress) {
        // Fetch ENS name
        let ensName = "";
        try {
          // @ts-ignore
          ensName = await client.readContract({
            address: resolverAddress,
            abi: resolverAbi,
            functionName: "ensNameOf",
            args: [agent as Address],
          });
        } catch {}

        // Fetch text records live from chain
        const keys = [
          "humangate.verified",
          "humangate.verifiedAt",
          "humangate.label",
          "humangate.contract",
          "humangate.chain",
          "description",
        ];
        const records: TextRecord[] = [];
        for (const key of keys) {
          try {
            // @ts-ignore
            const value = await client.readContract({
              address: resolverAddress,
              abi: resolverAbi,
              functionName: "text",
              args: [agent as Address, key],
            });
            if (value) records.push({ key, value });
          } catch {}
        }

        setState({
          step: "passed",
          agent,
          ensName: ensName || agent.slice(0, 10) + ".humanbacked.eth",
          records,
        });
      } else if (verified) {
        setState({
          step: "passed",
          agent,
          ensName: agent.slice(2, 10).toLowerCase() + ".humanbacked.eth",
          records: [{ key: "humangate.verified", value: "true" }],
        });
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

  function formatTimestamp(ts: string): string {
    const n = parseInt(ts);
    if (isNaN(n)) return ts;
    return new Date(n * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function truncAddr(a: string): string {
    if (a.length <= 14) return a;
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  // ── PASSED: Agent Passport ──
  if (state.step === "passed") {
    const verifiedAt = state.records.find((r) => r.key === "humangate.verifiedAt")?.value;
    const label = state.records.find((r) => r.key === "humangate.label")?.value;
    const chain = state.records.find((r) => r.key === "humangate.chain")?.value;
    const desc = state.records.find((r) => r.key === "description")?.value;

    return (
      <main className="relative min-h-screen">
        <div className="absolute inset-0 grid-pattern opacity-15" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[120px]" />

        <div className="relative z-10 flex flex-col items-center px-4 pt-8 sm:pt-12 pb-20">
          {/* Passport Card */}
          <div className="w-full max-w-md animate-scale-in">
            <div className="pass-card glow-accent overflow-hidden">
              {/* Top bar */}
              <div className="h-1 w-full bg-gradient-to-r from-accent/0 via-accent to-accent/0" />

              <div className="relative z-10 p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 border border-accent/20">
                      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-accent-light">
                        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-bold text-white">Agent Passport</p>
                      <p className="text-[11px] text-accent-light/60">HumanGate Verified</p>
                    </div>
                  </div>
                  <div className="badge-verified text-[10px] px-2.5 py-1">VERIFIED</div>
                </div>

                {/* Agent identity */}
                <div className="mb-6">
                  <p className="text-2xl font-bold text-white mb-1">
                    {state.ensName || label + ".humanbacked.eth"}
                  </p>
                  <p className="text-xs font-mono text-white/30">{state.agent}</p>
                </div>

                {/* Divider with cutouts */}
                <div className="relative my-5">
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="border-t border-dashed border-white/[0.08]" />
                </div>

                {/* On-chain records */}
                <div className="space-y-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20">
                    On-Chain Records (live from World Chain)
                  </p>

                  {verifiedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/40">Verified</span>
                      <span className="text-xs text-white/70">{formatTimestamp(verifiedAt)}</span>
                    </div>
                  )}

                  {chain && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/40">Chain</span>
                      <span className="text-xs text-white/70">World Chain ({chain})</span>
                    </div>
                  )}

                  {label && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/40">ENS Name</span>
                      <span className="text-xs text-accent">{label}.humanbacked.eth</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40">Status</span>
                    <span className="text-xs text-accent font-medium">Active</span>
                  </div>
                </div>

                {/* Description */}
                {desc && (
                  <div className="mt-4 p-3 rounded-lg bg-black/20 border border-white/[0.04]">
                    <p className="text-[11px] text-white/40 italic">{desc}</p>
                  </div>
                )}

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="border-t border-dashed border-white/[0.08]" />
                </div>

                {/* Raw text records */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20 mb-3">
                    ENS Text Records
                  </p>
                  <div className="space-y-1.5">
                    {state.records.map((r) => (
                      <div key={r.key} className="flex gap-2 text-[11px] font-mono">
                        <span className="text-accent/50 shrink-0">{r.key}:</span>
                        <span className="text-white/40 break-all">
                          {r.key === "humangate.verifiedAt"
                            ? formatTimestamp(r.value)
                            : r.value.length > 30
                              ? truncAddr(r.value)
                              : r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contract link */}
                <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] text-white/15">HumanGate on World Chain</span>
                  <span className="text-[10px] font-mono text-white/15">
                    {contractAddress ? truncAddr(contractAddress) : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions below passport */}
          <div className="w-full max-w-md mt-6 space-y-3 animate-fade-in-up delay-300 fill-mode-forwards opacity-0">
            <p className="text-center text-xs text-white/20 mb-2">This agent passed the gate. No CAPTCHA needed.</p>

            <div className="grid grid-cols-2 gap-3">
              <Link href="/widget" className="btn-secondary py-3 text-xs justify-center">
                Verify Another
              </Link>
              <Link href="/dashboard" className="btn-secondary py-3 text-xs justify-center">
                Dashboard
              </Link>
            </div>

            <button
              onClick={() => setState({ step: "gate" })}
              className="w-full text-center text-[11px] text-white/20 hover:text-white/40 transition-colors py-2"
            >
              Check another agent
            </button>
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
