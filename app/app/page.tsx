"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPublicClient, http, type Address } from "viem";
import { IDKitRequestWidget, orbLegacy, type RpContext } from "@worldcoin/idkit";

const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] } },
} as const;

const gateAbi = [{ type: "function", name: "isVerified", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" }] as const;
const resolverAbi = [
  { type: "function", name: "ensNameOf", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "text", inputs: [{ name: "agent", type: "address" }, { name: "key", type: "string" }], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "names", inputs: [{ name: "", type: "bytes32" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
] as const;

interface TextRecord { key: string; value: string; }

type View =
  | { step: "captcha" }
  | { step: "expand"; mode: "agent" | "human" }
  | { step: "checking" }
  | { step: "blocked"; agent: string }
  | { step: "verifying" }
  | { step: "passed"; agent: string; ensName: string; records: TextRecord[] };

export default function Home() {
  const [view, setView] = useState<View>({ step: "captcha" });
  const [agent, setAgent] = useState("");
  const agentRef = React.useRef("");
  const [agentLabel, setAgentLabel] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [showWalletInput, setShowWalletInput] = useState(false);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [rpReady, setRpReady] = useState(false);

  const contractAddress = process.env.NEXT_PUBLIC_HUMANGATE_CONTRACT as Address | undefined;
  const resolverAddress = process.env.NEXT_PUBLIC_RESOLVER_CONTRACT as Address | undefined;
  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx") as `app_${string}`;

  // Keep ref in sync
  useEffect(() => { agentRef.current = agent; }, [agent]);

  useEffect(() => {
    if (view.step === "expand" && view.mode === "human") {
      fetch("/api/rp-signature", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify-agent-v3" }) })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => { setRpContext({ rp_id: data.rp_id, nonce: data.nonce, created_at: data.created_at, expires_at: data.expires_at, signature: data.sig }); setRpReady(true); })
        .catch(() => setRpReady(true));
    } else { setRpReady(false); }
  }, [view.step, (view as any).mode]);

  async function resolveInput(input: string): Promise<string | null> {
    if (input.startsWith("0x") && input.length === 42) return input;
    if (!resolverAddress) return null;
    const client = createPublicClient({ chain: worldChain, transport: http() });
    const label = input.replace(/\.humanbacked\.eth$/i, "").toLowerCase();
    try {
      const { keccak256, toBytes } = await import("viem");
      // @ts-ignore
      const resolved = await client.readContract({ address: resolverAddress, abi: resolverAbi, functionName: "names", args: [keccak256(toBytes(label))] });
      if (resolved && resolved !== "0x0000000000000000000000000000000000000000") return resolved as string;
    } catch {} return null;
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
        const val = await client.readContract({ address: resolverAddress, abi: resolverAbi, functionName: "text", args: [addr as Address, key] });
        if (val) records.push({ key, value: val });
      } catch {}
    }
    return { ensName: ensName || addr.slice(2, 10) + ".humanbacked.eth", records };
  }

  async function checkAgent() {
    if (!agent || !contractAddress) return;
    setView({ step: "checking" });
    try {
      const resolved = await resolveInput(agent);
      if (!resolved) { setView({ step: "blocked", agent }); return; }
      const client = createPublicClient({ chain: worldChain, transport: http() });
      // @ts-ignore
      const verified = await client.readContract({ address: contractAddress, abi: gateAbi, functionName: "isVerified", args: [resolved as Address] });
      if (verified) { const d = await fetchRecords(resolved); setView({ step: "passed", agent: resolved, ...d }); }
      else { setView({ step: "blocked", agent: resolved }); }
    } catch { setView({ step: "blocked", agent }); }
  }

  async function handleVerify(result: any) {
    setOpen(false);
    const currentAgent = agentRef.current;
    console.log("handleVerify called, agent:", currentAgent);
    if (!currentAgent) { console.error("No agent address"); setView({ step: "expand", mode: "human" }); return; }
    setView({ step: "verifying" });
    try {
      const response = result.responses?.[0] ?? result;
      const res = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof: { merkle_root: response.merkle_root, nullifier_hash: response.nullifier_hash ?? response.nullifier, proof: response.proof }, agentId: currentAgent, agentLabel: agentLabel || undefined, idkitPayload: result }),
      });
      const data = await res.json();
      console.log("Verify response:", res.status, data);
      if (!res.ok) { alert("Verification error: " + (data.error || "Unknown")); setView({ step: "expand", mode: "human" }); return; }
      const d = await fetchRecords(currentAgent);
      setView({ step: "passed", agent: currentAgent, ...d });
    } catch (err: any) { console.error("handleVerify error:", err); alert("Error: " + err.message); setView({ step: "expand", mode: "human" }); }
  }

  function formatTs(ts: string) { const n = parseInt(ts); return isNaN(n) ? ts : new Date(n * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function trunc(a: string) { return a.length <= 14 ? a : a.slice(0, 6) + "..." + a.slice(-4); }

  // ══════════════ PASSPORT ══════════════
  if (view.step === "passed") {
    const v = view; const verifiedAt = v.records.find(r => r.key === "humangate.verifiedAt")?.value;
    const label = v.records.find(r => r.key === "humangate.label")?.value;
    const chain = v.records.find(r => r.key === "humangate.chain")?.value;
    const desc = v.records.find(r => r.key === "description")?.value;
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f0f0f0" }}>
        <div className="w-full max-w-md animate-scale-in">
          <div className="rounded-lg overflow-hidden" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            {/* Green verified bar */}
            <div className="h-1.5 bg-emerald-500" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{v.ensName}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{v.agent}</p>
                </div>
              </div>
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                {verifiedAt && <div className="flex justify-between px-4 py-2.5"><span className="text-xs text-gray-400">Verified</span><span className="text-xs text-gray-700">{formatTs(verifiedAt)}</span></div>}
                {chain && <div className="flex justify-between px-4 py-2.5"><span className="text-xs text-gray-400">Chain</span><span className="text-xs text-gray-700">World Chain ({chain})</span></div>}
                {label && <div className="flex justify-between px-4 py-2.5"><span className="text-xs text-gray-400">ENS</span><span className="text-xs text-emerald-600 font-medium">{label}.humanbacked.eth</span></div>}
                <div className="flex justify-between px-4 py-2.5"><span className="text-xs text-gray-400">Status</span><span className="text-xs text-emerald-600 font-medium">Verified</span></div>
              </div>
              {desc && <p className="mt-3 text-[11px] text-gray-400 italic">{desc}</p>}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-300 font-mono mb-2">ENS Text Records (on-chain)</p>
                {v.records.map(r => (
                  <div key={r.key} className="flex gap-1.5 text-[10px] font-mono leading-relaxed">
                    <span className="text-emerald-500/70">{r.key}:</span>
                    <span className="text-gray-400">{r.key === "humangate.verifiedAt" ? formatTs(r.value) : r.value.length > 30 ? trunc(r.value) : r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-3 flex justify-between items-center" style={{ background: "#fafafa", borderTop: "1px solid #eee" }}>
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-gray-300"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                <span className="text-[10px] text-gray-400 font-medium">HumanGate</span>
              </div>
              <button onClick={() => { setView({ step: "captcha" }); setAgent(""); setAgentLabel(""); setChecked(false); setGeneratedKey(""); }} className="text-[10px] text-gray-400 hover:text-gray-600">Check another</button>
            </div>
          </div>

          {/* What your agent can do now */}
          <div className="mt-4 rounded-lg overflow-hidden animate-fade-in-up" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Your agent can now access:</p>
              <p className="text-[11px] text-gray-400 mt-0.5">No CAPTCHA needed. Your agent passes the gate autonomously.</p>
            </div>

            {/* Faucet example */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 text-emerald-500">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">Token Faucet</p>
                  <p className="text-[10px] text-gray-400">Claim testnet tokens</p>
                </div>
              </div>
              <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full">Access granted</span>
            </div>

            {/* API example */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 text-blue-500">
                    <path d="M4 6h12M4 10h12M4 14h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">Protected API</p>
                  <p className="text-[10px] text-gray-400">Rate-limited data access</p>
                </div>
              </div>
              <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full">Access granted</span>
            </div>

            {/* Bounty example */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 text-purple-500">
                    <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">Bounty Board</p>
                  <p className="text-[10px] text-gray-400">Claim bounties autonomously</p>
                </div>
              </div>
              <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full">Access granted</span>
            </div>
          </div>

          {/* Agent wallet info */}
          {generatedKey && (
            <div className="mt-4 rounded-lg overflow-hidden animate-fade-in-up" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
              <div className="px-6 py-4">
                <p className="text-xs font-bold text-gray-900 mb-2">Agent credentials</p>
                <p className="text-[10px] text-gray-400 mb-3">Assign these to your agent so it can operate autonomously.</p>
                <div className="space-y-2">
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-[9px] text-gray-400 mb-0.5">WALLET ADDRESS</p>
                    <p className="text-[11px] font-mono text-gray-600 break-all select-all">{v.agent}</p>
                  </div>
                  <div className="rounded-md bg-amber-50 border border-amber-100 p-3">
                    <p className="text-[9px] text-amber-500 mb-0.5">PRIVATE KEY — save this</p>
                    <p className="text-[11px] font-mono text-amber-700 break-all select-all">{generatedKey}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-[9px] text-gray-400 mb-0.5">ENS NAME</p>
                    <p className="text-[11px] font-mono text-emerald-600 select-all">{v.ensName}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ══════════════ VERIFYING SPINNER ══════════════
  if (view.step === "verifying" || view.step === "checking") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#f0f0f0" }}>
        <div className="rounded-lg p-8 flex flex-col items-center gap-4" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <div className="h-10 w-10 rounded-full border-2 border-gray-200 border-t-emerald-500 animate-spin" />
          <p className="text-sm text-gray-500">{view.step === "verifying" ? "Registering on World Chain..." : "Checking on-chain..."}</p>
        </div>
      </main>
    );
  }

  // ══════════════ CAPTCHA GATE ══════════════
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f0f0f0" }}>
      <div className="w-full max-w-sm">
        {/* reCAPTCHA-style widget */}
        <div className="rounded-sm overflow-hidden" style={{ background: "#fff", border: "1px solid #d3d3d3", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>

          {/* ── Initial checkbox state ── */}
          {view.step === "captcha" && (
            <>
              <div className="px-4 py-5 flex items-center gap-4">
                {/* The checkbox */}
                <button
                  onClick={() => setChecked(!checked)}
                  className="shrink-0 h-7 w-7 rounded-sm border-2 border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center"
                  style={{ background: checked ? "#fff" : "#fff" }}
                >
                  {checked && (
                    <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5 text-emerald-500 animate-scale-in">
                      <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-sm text-gray-700 select-none">I'm not a bot</span>

                {/* HumanGate logo */}
                <div className="ml-auto flex flex-col items-center gap-0.5">
                  <svg viewBox="0 0 24 28" fill="none" className="h-7 w-7">
                    <path d="M12 1L2 6v5c0 7.73 4.26 14.96 10 16.67C17.74 25.96 22 18.73 22 11V6L12 1z" fill="#f0f0f0" stroke="#10b981" strokeWidth="1" />
                    <rect x="7" y="10" width="1.5" height="7" rx="0.75" fill="#10b981" opacity="0.4" />
                    <rect x="9.5" y="8.5" width="1.5" height="8.5" rx="0.75" fill="#10b981" opacity="0.5" />
                    <rect x="11.25" y="7.5" width="1.5" height="10" rx="0.75" fill="#10b981" opacity="0.6" />
                    <rect x="13" y="8.5" width="1.5" height="8.5" rx="0.75" fill="#10b981" opacity="0.5" />
                    <rect x="15.5" y="10" width="1.5" height="7" rx="0.75" fill="#10b981" opacity="0.4" />
                  </svg>
                  <span className="text-[8px] text-gray-400 font-bold tracking-wider">HumanGate</span>
                  <div className="flex gap-1.5 text-[7px] text-gray-300">
                    <span>Privacy</span>
                    <span>-</span>
                    <span>Terms</span>
                  </div>
                </div>
              </div>

              {/* Choose path — only visible when checked */}
              {checked && (
                <div className="border-t border-gray-200 animate-fade-in-down">
                  <div className="p-3 space-y-2">
                    <p className="text-[11px] text-gray-400 text-center mb-2">Who are you?</p>
                    <button
                      onClick={() => setView({ step: "expand", mode: "agent" })}
                      className="w-full flex items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-gray-50 transition-colors border border-gray-100"
                    >
                      <div className="h-8 w-8 rounded-md bg-gray-100 flex items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-gray-400">
                          <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2" />
                          <circle cx="10" cy="9" r="2" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M6 15c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700">I'm a human-backed agent</p>
                        <p className="text-[10px] text-gray-400">Already verified? Check my status</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setView({ step: "expand", mode: "human" })}
                      className="w-full flex items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-emerald-50 transition-colors border border-gray-100"
                    >
                      <div className="h-8 w-8 rounded-md bg-emerald-50 flex items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-emerald-500">
                          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700">I'm a human</p>
                        <p className="text-[10px] text-gray-400">Register my agent for the first time</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Agent flow ── */}
          {view.step === "expand" && view.mode === "agent" && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setView({ step: "captcha" }); setChecked(true); }} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <p className="text-xs font-medium text-gray-500">Check agent status</p>
              </div>
              <div className="space-y-3">
                <input type="text" placeholder="0x... or bob.humanbacked.eth" value={agent} onChange={e => setAgent(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && agent && checkAgent()}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 font-mono placeholder-gray-300 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition-all" />
                <button onClick={checkAgent} disabled={!agent}
                  className="w-full rounded-md py-2.5 text-sm font-medium text-white transition-all disabled:opacity-40"
                  style={{ background: "#10b981" }}>
                  Check status
                </button>
              </div>
            </div>
          )}

          {/* ── Blocked ── */}
          {view.step === "blocked" && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setView({ step: "captcha" }); setChecked(true); }} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <p className="text-xs font-medium text-gray-500">Result</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 mb-3">
                <p className="text-sm text-amber-700 font-medium">Agent not verified</p>
                <p className="text-[11px] text-amber-500 mt-0.5">Not in the HumanGate whitelist</p>
              </div>
              <button onClick={() => { setView({ step: "expand", mode: "human" }); }}
                className="w-full rounded-md border border-gray-200 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Register this agent →
              </button>
            </div>
          )}

          {/* ── Human flow ── */}
          {view.step === "expand" && view.mode === "human" && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setView({ step: "captcha" }); setChecked(true); }} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <p className="text-xs font-medium text-gray-500">Register agent</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-1">AGENT NAME</label>
                  <input type="text" placeholder="bob" value={agentLabel} onChange={e => setAgentLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition-all" />
                  {agentLabel && <p className="mt-1 text-[11px] text-emerald-500">{agentLabel}.humanbacked.eth</p>}
                </div>
                <div>
                  {!agent && !showWalletInput && (
                    <p className="text-[10px] text-gray-400 mb-1">A wallet will be generated automatically for your agent.
                      <button onClick={() => setShowWalletInput(true)} className="text-emerald-500 ml-1 hover:underline">I already have a wallet</button>
                    </p>
                  )}
                  {showWalletInput && (
                    <>
                      <label className="block text-[10px] font-medium text-gray-400 mb-1">AGENT WALLET</label>
                      <input type="text" placeholder="0x..." value={agent} onChange={e => { setAgent(e.target.value); setGeneratedKey(""); }}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 font-mono placeholder-gray-300 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition-all" />
                    </>
                  )}
                  {agent && generatedKey && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
                      <p className="text-[10px] text-amber-600 font-medium mb-1">Agent wallet created — save this private key</p>
                      <p className="text-[10px] font-mono text-gray-500 mb-1">{agent}</p>
                      <p className="text-[10px] font-mono text-amber-700 break-all select-all">{generatedKey}</p>
                    </div>
                  )}
                </div>
                {rpReady ? (
                  <>
                    <button onClick={async () => {
                      let addr = agentRef.current;
                      if (!addr) {
                        const r = await fetch("/api/generate-wallet", { method: "POST" });
                        const d = await r.json();
                        addr = d.address;
                        setAgent(addr);
                        agentRef.current = addr;
                        setGeneratedKey(d.privateKey);
                        // Wait for React to re-render so IDKit gets the new signal
                        await new Promise(resolve => setTimeout(resolve, 500));
                      }
                      setOpen(true);
                    }} disabled={!agentLabel}
                      className="w-full rounded-md py-2.5 text-sm font-medium text-white transition-all disabled:opacity-40"
                      style={{ background: "#10b981" }}>
                      Verify with World ID
                    </button>
                    {agent && (
                      <IDKitRequestWidget open={open} onOpenChange={setOpen} app_id={appId} action="verify-agent-v3"
                        rp_context={rpContext ?? { rp_id: "", nonce: "", created_at: 0, expires_at: 0, signature: "" }}
                        allow_legacy_proofs preset={orbLegacy({ signal: agent })} environment="staging"
                        handleVerify={handleVerify} onSuccess={() => {}} onError={() => {}} />
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <div className="h-3 w-3 rounded-full border border-gray-200 border-t-emerald-500 animate-spin" />
                    <span className="text-[11px] text-gray-400">Loading...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer — always visible */}
          <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: "#fafafa", borderTop: "1px solid #eee" }}>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 28" fill="none" className="h-5 w-5">
                <path d="M12 1L2 6v5c0 7.73 4.26 14.96 10 16.67C17.74 25.96 22 18.73 22 11V6L12 1z" fill="none" stroke="#10b981" strokeWidth="1" />
              </svg>
              <span className="text-[9px] text-gray-400 font-bold tracking-wider">HumanGate</span>
            </div>
            <div className="flex gap-2 text-[8px] text-gray-300">
              <span>Privacy</span>
              <span>-</span>
              <span>Terms</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
