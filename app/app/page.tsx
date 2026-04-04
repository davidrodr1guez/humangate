"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createPublicClient, http, type Address } from "viem";
import { IDKitRequestWidget, orbLegacy, type RpContext } from "@worldcoin/idkit";

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
  | { step: "register"; agent: string }
  | { step: "verifying"; agent: string }
  | { step: "passed"; agent: string; ensName: string; records: TextRecord[] };

export default function Home() {
  const [agent, setAgent] = useState("");
  const [agentLabel, setAgentLabel] = useState("");
  const [tab, setTab] = useState<"check" | "register">("check");
  const [state, setState] = useState<GateState>({ step: "gate" });
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [rpReady, setRpReady] = useState(false);

  const contractAddress = process.env.NEXT_PUBLIC_HUMANGATE_CONTRACT as Address | undefined;
  const resolverAddress = process.env.NEXT_PUBLIC_RESOLVER_CONTRACT as Address | undefined;
  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx") as `app_${string}`;

  // Fetch RP signature when on register tab
  useEffect(() => {
    if (tab !== "register") {
      setRpReady(false);
      return;
    }

    fetch("/api/rp-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-agent" }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("not configured");
        return r.json();
      })
      .then((data) => {
        setRpContext({
          rp_id: data.rp_id,
          nonce: data.nonce,
          created_at: data.created_at,
          expires_at: data.expires_at,
          signature: data.sig,
        });
        setRpReady(true);
      })
      .catch(() => setRpReady(true));
  }, [tab]);

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
        await fetchPassport(agent);
      } else {
        setState({ step: "blocked", agent });
      }
    } catch {
      setState({ step: "blocked", agent });
    }
  }

  async function fetchPassport(agentAddr: string) {
    const client = createPublicClient({ chain: worldChain, transport: http() });
    let ensName = "";
    const records: TextRecord[] = [];

    if (resolverAddress) {
      try {
        // @ts-ignore
        ensName = await client.readContract({
          address: resolverAddress, abi: resolverAbi, functionName: "ensNameOf", args: [agentAddr as Address],
        });
      } catch {}

      const keys = ["humangate.verified", "humangate.verifiedAt", "humangate.label", "humangate.contract", "humangate.chain", "description"];
      for (const key of keys) {
        try {
          // @ts-ignore
          const value = await client.readContract({
            address: resolverAddress, abi: resolverAbi, functionName: "text", args: [agentAddr as Address, key],
          });
          if (value) records.push({ key, value });
        } catch {}
      }
    }

    setState({
      step: "passed",
      agent: agentAddr,
      ensName: ensName || agentAddr.slice(2, 10).toLowerCase() + ".humanbacked.eth",
      records: records.length ? records : [{ key: "humangate.verified", value: "true" }],
    });
  }

  async function handleVerify(result: any) {
    setState({ step: "verifying", agent: state.step === "register" ? (state as any).agent : agent });

    try {
      const response = result.responses?.[0] ?? result;
      const proof = {
        merkle_root: response.merkle_root,
        nullifier_hash: response.nullifier_hash ?? response.nullifier,
        proof: response.proof,
      };

      const currentAgent = (state as any).agent || agent;

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof,
          agentId: currentAgent,
          agentLabel: agentLabel || undefined,
          idkitPayload: result,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setState({ step: "blocked", agent: currentAgent });
        return;
      }

      // Fetch the passport data from chain
      await fetchPassport(currentAgent);
    } catch {
      setState({ step: "blocked", agent: (state as any).agent || agent });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && agent) checkGate();
  }

  function formatTimestamp(ts: string): string {
    const n = parseInt(ts);
    if (isNaN(n)) return ts;
    return new Date(n * 1000).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function truncAddr(a: string): string {
    if (a.length <= 14) return a;
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  // ════════════════════════════════════════════
  // PASSED: Agent Passport
  // ════════════════════════════════════════════
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
          <div className="w-full max-w-md animate-scale-in">
            <div className="pass-card glow-accent overflow-hidden">
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

                {/* Identity */}
                <div className="mb-6">
                  <p className="text-2xl font-bold text-white mb-1">{state.ensName}</p>
                  <p className="text-xs font-mono text-white/30">{state.agent}</p>
                </div>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="border-t border-dashed border-white/[0.08]" />
                </div>

                {/* On-chain data */}
                <div className="space-y-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20">On-Chain Records (live from World Chain)</p>
                  {verifiedAt && (
                    <div className="flex justify-between"><span className="text-xs text-white/40">Verified</span><span className="text-xs text-white/70">{formatTimestamp(verifiedAt)}</span></div>
                  )}
                  {chain && (
                    <div className="flex justify-between"><span className="text-xs text-white/40">Chain</span><span className="text-xs text-white/70">World Chain ({chain})</span></div>
                  )}
                  {label && (
                    <div className="flex justify-between"><span className="text-xs text-white/40">ENS Name</span><span className="text-xs text-accent">{label}.humanbacked.eth</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-xs text-white/40">Status</span><span className="text-xs text-accent font-medium">Active</span></div>
                </div>

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

                {/* Raw records */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20 mb-3">ENS Text Records</p>
                  <div className="space-y-1.5">
                    {state.records.map((r) => (
                      <div key={r.key} className="flex gap-2 text-[11px] font-mono">
                        <span className="text-accent/50 shrink-0">{r.key}:</span>
                        <span className="text-white/40 break-all">
                          {r.key === "humangate.verifiedAt" ? formatTimestamp(r.value) : r.value.length > 30 ? truncAddr(r.value) : r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] text-white/15">HumanGate on World Chain</span>
                  <span className="text-[10px] font-mono text-white/15">{contractAddress ? truncAddr(contractAddress) : ""}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md mt-6 animate-fade-in-up delay-300 fill-mode-forwards opacity-0">
            <button onClick={() => { setState({ step: "gate" }); setAgent(""); setAgentLabel(""); }} className="w-full btn-secondary py-3 text-xs">
              Check another agent
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ════════════════════════════════════════════
  // GATE: Check / Register tabs
  // ════════════════════════════════════════════
  return (
    <main className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 grid-pattern opacity-15" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/[0.03] rounded-full blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm px-4 py-12">
        {/* Shield */}
        <div className="flex justify-center mb-6 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 h-20 w-20 rounded-full bg-accent/10 blur-xl" />
            <svg viewBox="0 0 64 72" fill="none" className="relative h-20 w-20 animate-float">
              <path d="M32 4L6 18v16c0 18.5 11.1 35.8 26 40 14.9-4.2 26-21.5 26-40V18L32 4z" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.4)" strokeWidth="1.5" />
              <rect x="22" y="28" width="2" height="18" rx="1" fill="rgba(255,255,255,0.2)" />
              <rect x="27" y="24" width="2" height="22" rx="1" fill="rgba(255,255,255,0.3)" />
              <rect x="31" y="22" width="2" height="24" rx="1" fill="rgba(255,255,255,0.35)" />
              <rect x="35" y="24" width="2" height="22" rx="1" fill="rgba(255,255,255,0.3)" />
              <rect x="40" y="28" width="2" height="18" rx="1" fill="rgba(255,255,255,0.2)" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6 animate-fade-in-up">
          <h1 className="text-xl font-bold text-white mb-1.5">HumanGate</h1>
          <p className="text-xs text-white/30">The verification gateway for human-backed agents</p>
        </div>

        {/* Card */}
        <div className="glass-card animate-fade-in-up delay-200 fill-mode-forwards opacity-0">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.06]">
            <button
              onClick={() => { setTab("check"); setState({ step: "gate" }); }}
              className={`flex-1 py-3.5 text-xs font-medium transition-all duration-200 ${
                tab === "check"
                  ? "text-white border-b-2 border-accent"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              Check Agent
            </button>
            <button
              onClick={() => { setTab("register"); setState({ step: "gate" }); }}
              className={`flex-1 py-3.5 text-xs font-medium transition-all duration-200 ${
                tab === "register"
                  ? "text-white border-b-2 border-accent"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              Register Agent
            </button>
          </div>

          <div className="p-5">
            {/* ── CHECK TAB ── */}
            {tab === "check" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">Agent Address or ENS</label>
                  <input
                    type="text"
                    placeholder="0x... or mybot.humanbacked.eth"
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
                        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M6 8l1.5 1.5L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Check Status
                    </>
                  )}
                </button>

                {state.step === "blocked" && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 animate-fade-in">
                    <p className="text-sm text-amber-400 font-medium mb-1">Agent not verified</p>
                    <p className="text-xs text-white/30 mb-3">This agent is not in the HumanGate whitelist.</p>
                    <button
                      onClick={() => { setTab("register"); setState({ step: "gate" }); }}
                      className="inline-flex items-center gap-1.5 text-xs text-accent font-medium hover:text-accent-light transition-colors"
                    >
                      Register this agent
                      <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── REGISTER TAB ── */}
            {tab === "register" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">Agent Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={agent}
                    onChange={(e) => setAgent(e.target.value)}
                    disabled={state.step === "verifying"}
                    className="input-field font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">Agent Name</label>
                  <input
                    type="text"
                    placeholder="mybot"
                    value={agentLabel}
                    onChange={(e) => setAgentLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    disabled={state.step === "verifying"}
                    className="input-field text-sm"
                  />
                  {agentLabel && (
                    <p className="mt-1.5 text-[11px] text-accent/50">{agentLabel}.humanbacked.eth</p>
                  )}
                </div>

                {state.step === "verifying" ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="h-12 w-12 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                    <p className="text-sm text-white/60">Registering on-chain...</p>
                    <div className="w-32 h-1 rounded-full overflow-hidden bg-white/[0.04]">
                      <div className="h-full w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-shimmer bg-200%" />
                    </div>
                  </div>
                ) : rpReady ? (
                  <>
                    <button
                      onClick={() => setOpen(true)}
                      disabled={!agent}
                      className="btn-primary w-full py-3.5 text-sm disabled:opacity-40"
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.4" />
                      </svg>
                      Verify with World ID
                    </button>
                    {agent && (
                      <IDKitRequestWidget
                        open={open}
                        onOpenChange={setOpen}
                        app_id={appId}
                        action="verify-agent"
                        rp_context={rpContext ?? { rp_id: "", nonce: "", created_at: 0, expires_at: 0, signature: "" }}
                        allow_legacy_proofs
                        preset={orbLegacy({ signal: agent })}
                        environment="production"
                        handleVerify={handleVerify}
                        onSuccess={() => {}}
                        onError={() => setState({ step: "gate" })}
                      />
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="h-3.5 w-3.5 rounded-full border border-white/10 border-t-white/40 animate-spin" />
                    <span className="text-xs text-white/25">Preparing verification...</span>
                  </div>
                )}
              </div>
            )}
          </div>
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
