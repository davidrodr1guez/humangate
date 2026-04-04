"use client";

import { useState, useEffect } from "react";
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

const gateAbi = [{
  type: "function", name: "isVerified",
  inputs: [{ name: "agent", type: "address" }],
  outputs: [{ name: "", type: "bool" }],
  stateMutability: "view",
}] as const;

const resolverAbi = [
  { type: "function", name: "ensNameOf", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "text", inputs: [{ name: "agent", type: "address" }, { name: "key", type: "string" }], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "names", inputs: [{ name: "", type: "bytes32" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
] as const;

interface TextRecord { key: string; value: string; }

type View =
  | { step: "choose" }
  | { step: "agent-input" }
  | { step: "agent-checking" }
  | { step: "agent-blocked"; agent: string }
  | { step: "agent-passed"; agent: string; ensName: string; records: TextRecord[] }
  | { step: "human-input" }
  | { step: "human-verifying" }
  | { step: "human-done"; agent: string; ensName: string; records: TextRecord[] };

export default function Home() {
  const [view, setView] = useState<View>({ step: "choose" });
  const [agent, setAgent] = useState("");
  const [agentLabel, setAgentLabel] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [rpReady, setRpReady] = useState(false);

  const contractAddress = process.env.NEXT_PUBLIC_HUMANGATE_CONTRACT as Address | undefined;
  const resolverAddress = process.env.NEXT_PUBLIC_RESOLVER_CONTRACT as Address | undefined;
  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx") as `app_${string}`;

  useEffect(() => {
    if (view.step !== "human-input") { setRpReady(false); return; }
    fetch("/api/rp-signature", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify-agent" }) })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setRpContext({ rp_id: data.rp_id, nonce: data.nonce, created_at: data.created_at, expires_at: data.expires_at, signature: data.sig }); setRpReady(true); })
      .catch(() => setRpReady(true));
  }, [view.step]);

  async function resolveInput(input: string): Promise<string | null> {
    if (input.startsWith("0x") && input.length === 42) return input;
    if (!resolverAddress) return null;
    const client = createPublicClient({ chain: worldChain, transport: http() });
    const label = input.replace(/\.humanbacked\.eth$/i, "").toLowerCase();
    try {
      const { keccak256, toBytes } = await import("viem");
      const labelhash = keccak256(toBytes(label));
      // @ts-ignore
      const resolved = await client.readContract({ address: resolverAddress, abi: resolverAbi, functionName: "names", args: [labelhash] });
      if (resolved && resolved !== "0x0000000000000000000000000000000000000000") return resolved as string;
    } catch {}
    return null;
  }

  async function fetchRecords(addr: string): Promise<{ ensName: string; records: TextRecord[] }> {
    const client = createPublicClient({ chain: worldChain, transport: http() });
    let ensName = ""; const records: TextRecord[] = [];
    if (!resolverAddress) return { ensName: addr.slice(2, 10) + ".humanbacked.eth", records: [{ key: "humangate.verified", value: "true" }] };
    try { // @ts-ignore
      ensName = await client.readContract({ address: resolverAddress, abi: resolverAbi, functionName: "ensNameOf", args: [addr as Address] });
    } catch {}
    for (const key of ["humangate.verified", "humangate.verifiedAt", "humangate.label", "humangate.contract", "humangate.chain", "description"]) {
      try { // @ts-ignore
        const value = await client.readContract({ address: resolverAddress, abi: resolverAbi, functionName: "text", args: [addr as Address, key] });
        if (value) records.push({ key, value });
      } catch {}
    }
    return { ensName: ensName || addr.slice(2, 10) + ".humanbacked.eth", records };
  }

  async function checkAgent() {
    if (!agent || !contractAddress) return;
    setView({ step: "agent-checking" });
    try {
      const resolved = await resolveInput(agent);
      if (!resolved) { setView({ step: "agent-blocked", agent }); return; }
      const client = createPublicClient({ chain: worldChain, transport: http() });
      // @ts-ignore
      const verified = await client.readContract({ address: contractAddress, abi: gateAbi, functionName: "isVerified", args: [resolved as Address] });
      if (verified) {
        const { ensName, records } = await fetchRecords(resolved);
        setView({ step: "agent-passed", agent: resolved, ensName, records });
      } else { setView({ step: "agent-blocked", agent: resolved }); }
    } catch { setView({ step: "agent-blocked", agent }); }
  }

  async function handleVerify(result: any) {
    setOpen(false);
    setView({ step: "human-verifying" });
    try {
      const response = result.responses?.[0] ?? result;
      const res = await fetch("/api/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof: { merkle_root: response.merkle_root, nullifier_hash: response.nullifier_hash ?? response.nullifier, proof: response.proof },
          agentId: agent, agentLabel: agentLabel || undefined, idkitPayload: result,
        }),
      });
      if (!res.ok) { setView({ step: "human-input" }); return; }
      const { ensName, records } = await fetchRecords(agent);
      setView({ step: "human-done", agent, ensName, records });
    } catch { setView({ step: "human-input" }); }
  }

  function formatTs(ts: string) { const n = parseInt(ts); return isNaN(n) ? ts : new Date(n * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function trunc(a: string) { return a.length <= 14 ? a : a.slice(0, 6) + "..." + a.slice(-4); }

  // ════════════════════════════════════════════
  // PASSPORT VIEW (shared by agent-passed and human-done)
  // ════════════════════════════════════════════
  if (view.step === "agent-passed" || view.step === "human-done") {
    const v = view as { agent: string; ensName: string; records: TextRecord[] };
    const verifiedAt = v.records.find(r => r.key === "humangate.verifiedAt")?.value;
    const label = v.records.find(r => r.key === "humangate.label")?.value;
    const chain = v.records.find(r => r.key === "humangate.chain")?.value;
    const desc = v.records.find(r => r.key === "description")?.value;

    return (
      <main className="relative min-h-screen">
        <div className="absolute inset-0 grid-pattern opacity-15" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[120px]" />
        <div className="relative z-10 flex flex-col items-center px-4 pt-8 sm:pt-12 pb-20">
          <div className="w-full max-w-md animate-scale-in">
            <div className="pass-card glow-accent overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-accent/0 via-accent to-accent/0" />
              <div className="relative z-10 p-6 sm:p-8">
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
                <div className="mb-6">
                  <p className="text-2xl font-bold text-white mb-1">{v.ensName}</p>
                  <p className="text-xs font-mono text-white/30">{v.agent}</p>
                </div>
                <div className="relative my-5">
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="border-t border-dashed border-white/[0.08]" />
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20">On-Chain Records (live from World Chain)</p>
                  {verifiedAt && <div className="flex justify-between"><span className="text-xs text-white/40">Verified</span><span className="text-xs text-white/70">{formatTs(verifiedAt)}</span></div>}
                  {chain && <div className="flex justify-between"><span className="text-xs text-white/40">Chain</span><span className="text-xs text-white/70">World Chain ({chain})</span></div>}
                  {label && <div className="flex justify-between"><span className="text-xs text-white/40">ENS Name</span><span className="text-xs text-accent">{label}.humanbacked.eth</span></div>}
                  <div className="flex justify-between"><span className="text-xs text-white/40">Status</span><span className="text-xs text-accent font-medium">Active</span></div>
                </div>
                {desc && <div className="mt-4 p-3 rounded-lg bg-black/20 border border-white/[0.04]"><p className="text-[11px] text-white/40 italic">{desc}</p></div>}
                <div className="relative my-5">
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-0" />
                  <div className="border-t border-dashed border-white/[0.08]" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20 mb-3">ENS Text Records</p>
                  <div className="space-y-1.5">
                    {v.records.map(r => (
                      <div key={r.key} className="flex gap-2 text-[11px] font-mono">
                        <span className="text-accent/50 shrink-0">{r.key}:</span>
                        <span className="text-white/40 break-all">{r.key === "humangate.verifiedAt" ? formatTs(r.value) : r.value.length > 30 ? trunc(r.value) : r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => { setView({ step: "choose" }); setAgent(""); setAgentLabel(""); setGeneratedKey(""); }} className="mt-6 btn-secondary py-3 px-8 text-xs">Back to gate</button>
        </div>
      </main>
    );
  }

  // ════════════════════════════════════════════
  // VERIFYING SPINNER
  // ════════════════════════════════════════════
  if (view.step === "human-verifying") {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 grid-pattern opacity-15" />
        <div className="flex flex-col items-center gap-5">
          <div className="h-16 w-16 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
          <p className="text-sm text-white/60">Registering on World Chain...</p>
          <div className="w-48 h-1 rounded-full overflow-hidden bg-white/[0.04]">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-shimmer bg-200%" />
          </div>
        </div>
      </main>
    );
  }

  // ════════════════════════════════════════════
  // MAIN GATE — CAPTCHA-style
  // ════════════════════════════════════════════
  return (
    <main className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 grid-pattern opacity-15" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/[0.03] rounded-full blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm px-4 py-8">
        {/* CAPTCHA-style header */}
        <div className="flex justify-center mb-6 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 h-16 w-16 rounded-full bg-accent/10 blur-xl" />
            <svg viewBox="0 0 64 72" fill="none" className="relative h-16 w-16">
              <path d="M32 4L6 18v16c0 18.5 11.1 35.8 26 40 14.9-4.2 26-21.5 26-40V18L32 4z" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.4)" strokeWidth="1.5" />
              <rect x="22" y="28" width="2" height="18" rx="1" fill="rgba(255,255,255,0.2)" />
              <rect x="27" y="24" width="2" height="22" rx="1" fill="rgba(255,255,255,0.3)" />
              <rect x="31" y="22" width="2" height="24" rx="1" fill="rgba(255,255,255,0.35)" />
              <rect x="35" y="24" width="2" height="22" rx="1" fill="rgba(255,255,255,0.3)" />
              <rect x="40" y="28" width="2" height="18" rx="1" fill="rgba(255,255,255,0.2)" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-6 animate-fade-in-up">
          <h1 className="text-lg font-bold text-white mb-1">HumanGate</h1>
        </div>

        {/* ── CHOOSE: I'm an agent / I'm a human ── */}
        {view.step === "choose" && (
          <div className="space-y-3 animate-fade-in-up delay-200 fill-mode-forwards opacity-0">
            <button
              onClick={() => setView({ step: "agent-input" })}
              className="w-full glass-card p-5 text-left hover:border-white/[0.12] transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] group-hover:border-accent/30 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white/40 group-hover:text-accent transition-colors">
                    <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 17c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">I'm an agent</p>
                  <p className="text-[11px] text-white/30">Already registered? Check your status</p>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-white/15 ml-auto">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            <button
              onClick={() => setView({ step: "human-input" })}
              className="w-full glass-card p-5 text-left hover:border-accent/20 transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/[0.06] border border-accent/10 group-hover:border-accent/30 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-accent/60 group-hover:text-accent transition-colors">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4 20c0-4.42 3.58-8 8-8s8 3.58 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">I'm a human</p>
                  <p className="text-[11px] text-white/30">Register your agent for the first time</p>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-white/15 ml-auto">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* ── AGENT: check status ── */}
        {(view.step === "agent-input" || view.step === "agent-checking" || view.step === "agent-blocked") && (
          <div className="glass-card p-5 animate-fade-in-up">
            <button onClick={() => setView({ step: "choose" })} className="text-[11px] text-white/25 hover:text-white/50 mb-4 flex items-center gap-1 transition-colors">
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back
            </button>
            <p className="text-xs font-medium text-white/50 mb-4">Enter your agent address or ENS name</p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="0x... or bob.humanbacked.eth"
                value={agent}
                onChange={e => setAgent(e.target.value)}
                onKeyDown={e => e.key === "Enter" && agent && checkAgent()}
                className="input-field font-mono text-sm"
              />
              <button onClick={checkAgent} disabled={!agent || view.step === "agent-checking"} className="btn-primary w-full py-3.5 text-sm disabled:opacity-40">
                {view.step === "agent-checking" ? (
                  <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />Checking...</div>
                ) : "Check status"}
              </button>
              {view.step === "agent-blocked" && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 animate-fade-in">
                  <p className="text-sm text-amber-400 font-medium mb-1">Agent not verified</p>
                  <p className="text-xs text-white/30 mb-3">This agent is not in the HumanGate whitelist yet.</p>
                  <button onClick={() => { setView({ step: "human-input" }); }} className="text-xs text-accent font-medium hover:text-accent-light transition-colors">
                    Register this agent →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HUMAN: register agent ── */}
        {view.step === "human-input" && (
          <div className="glass-card p-5 animate-fade-in-up">
            <button onClick={() => setView({ step: "choose" })} className="text-[11px] text-white/25 hover:text-white/50 mb-4 flex items-center gap-1 transition-colors">
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back
            </button>
            <p className="text-xs font-medium text-white/50 mb-4">Register your agent — verify once, your agent accesses everything after</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">Agent Name</label>
                <input type="text" placeholder="bob" value={agentLabel} onChange={e => setAgentLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="input-field text-sm" />
                {agentLabel && <p className="mt-1.5 text-[11px] text-accent/50">{agentLabel}.humanbacked.eth</p>}
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                  Agent Wallet <span className="text-white/15">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input type="text" placeholder="0x... or leave empty" value={agent} onChange={e => { setAgent(e.target.value); setGeneratedKey(""); }} className="input-field font-mono text-sm flex-1" />
                  <button onClick={async () => { const r = await fetch("/api/generate-wallet", { method: "POST" }); const d = await r.json(); setAgent(d.address); setGeneratedKey(d.privateKey); }} className="btn-secondary px-3 py-2 text-[10px] shrink-0">Generate</button>
                </div>
                {generatedKey && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
                    <p className="text-[10px] text-amber-400 font-medium mb-1">Save this private key — shown only once</p>
                    <p className="text-[10px] font-mono text-white/50 break-all select-all">{generatedKey}</p>
                  </div>
                )}
              </div>
              {rpReady ? (
                <>
                  <button onClick={() => setOpen(true)} disabled={!agent || !agentLabel} className="btn-primary w-full py-3.5 text-sm disabled:opacity-40">
                    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.4" /></svg>
                    Verify with World ID
                  </button>
                  {agent && (
                    <IDKitRequestWidget open={open} onOpenChange={setOpen} app_id={appId} action="verify-agent"
                      rp_context={rpContext ?? { rp_id: "", nonce: "", created_at: 0, expires_at: 0, signature: "" }}
                      allow_legacy_proofs preset={orbLegacy({ signal: agent })} environment="production"
                      handleVerify={handleVerify} onSuccess={() => {}} onError={() => {}} />
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="h-3.5 w-3.5 rounded-full border border-white/10 border-t-white/40 animate-spin" />
                  <span className="text-xs text-white/25">Preparing verification...</span>
                </div>
              )}
            </div>
          </div>
        )}

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
