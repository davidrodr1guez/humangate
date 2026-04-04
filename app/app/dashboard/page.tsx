"use client";

import { useState } from "react";
import Link from "next/link";
import { createPublicClient, http, type Address } from "viem";

/* ------------------------------------------------------------------ */
/* Chain & ABI Configuration                                           */
/* ------------------------------------------------------------------ */

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
    name: "names",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type CheckResult =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "result";
      verified: boolean;
      agent: string;
      ensName: string | null;
    }
  | { status: "error"; message: string };

/* ------------------------------------------------------------------ */
/* Truncate helper                                                     */
/* ------------------------------------------------------------------ */

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* Dashboard Page                                                      */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [agent, setAgent] = useState("");
  const [result, setResult] = useState<CheckResult>({ status: "idle" });

  const contractAddress = process.env.NEXT_PUBLIC_HUMANGATE_CONTRACT as
    | Address
    | undefined;
  const resolverAddress = process.env.NEXT_PUBLIC_RESOLVER_CONTRACT as
    | Address
    | undefined;

  async function checkAgent() {
    if (!contractAddress) {
      setResult({
        status: "error",
        message: "Contract address not configured",
      });
      return;
    }
    setResult({ status: "loading" });

    try {
      const client = createPublicClient({
        chain: worldChain,
        transport: http(),
      });

      const verified = await client.readContract({
        address: contractAddress,
        abi: gateAbi,
        functionName: "isVerified",
        args: [agent as Address],
      });

      // Check ENS name registration
      let ensName: string | null = null;
      if (verified) {
        ensName = `${agent.toLowerCase()}.humanbacked.eth`;

        // Verify on-chain registration if resolver is configured
        if (resolverAddress) {
          try {
            const { keccak256, toBytes } = await import("viem");
            const label = agent.toLowerCase();
            const labelhash = keccak256(toBytes(label));
            const registered = await client.readContract({
              address: resolverAddress,
              abi: resolverAbi,
              functionName: "names",
              args: [labelhash],
            });
            if (
              registered ===
              "0x0000000000000000000000000000000000000000"
            ) {
              ensName += " (pending registration)";
            }
          } catch {
            // Resolver not available, show computed name
          }
        }
      }

      setResult({ status: "result", verified, agent, ensName });
    } catch (err: any) {
      setResult({ status: "error", message: err.message });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && agent) {
      checkAgent();
    }
  }

  return (
    <main className="relative min-h-screen">
      {/* Background */}
      <div className="absolute inset-0 dot-pattern opacity-40" />
      <div className="absolute top-10 right-1/4 w-[500px] h-[500px] bg-accent/[0.02] rounded-full blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
        {/* Page header */}
        <div className="text-center mb-10 opacity-0 animate-fade-in-up fill-mode-forwards">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-1.5 mb-4">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-white/30">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M6 8l1.5 1.5L10.5 6"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-xs text-white/40">Agent Lookup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Agent Dashboard
          </h1>
          <p className="mt-2 text-sm text-white/30 max-w-md mx-auto">
            Check if an AI agent is human-verified on World Chain
          </p>
        </div>

        {/* Search bar */}
        <div className="w-full max-w-lg mb-8 opacity-0 animate-fade-in-up fill-mode-forwards delay-200">
          <div className="glass-card p-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/15">
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <circle
                      cx="7"
                      cy="7"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M11 11l3 3"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Agent address (0x...)"
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-xl border-0 bg-transparent py-3 pl-10 pr-4 text-sm font-mono text-white placeholder-white/20 outline-none"
                />
              </div>
              <button
                onClick={checkAgent}
                disabled={!agent || result.status === "loading"}
                className="btn-primary px-6 py-3 text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {result.status === "loading" ? (
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>Checking</span>
                  </div>
                ) : (
                  "Check"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="w-full max-w-lg">
          {/* Loading state */}
          {result.status === "loading" && (
            <div className="animate-fade-in glass-card p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-4 w-4 text-accent/60"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="6.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-white/50">
                    Querying World Chain...
                  </p>
                  <p className="text-xs text-white/20 mt-1 font-mono">
                    {truncateAddress(agent)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Verified result */}
          {result.status === "result" && result.verified && (
            <div className="animate-scale-in space-y-4">
              <div className="pass-card glow-accent-sm overflow-hidden">
                {/* Top accent */}
                <div className="h-1 w-full bg-gradient-to-r from-accent/0 via-accent to-accent/0" />

                <div className="relative z-10 p-6 sm:p-8">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 border border-accent/20">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-6 w-6 text-accent-light"
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
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">
                          Human-Backed Agent
                        </p>
                        <p className="text-xs text-accent/50">
                          Verified on World Chain
                        </p>
                      </div>
                    </div>
                    <div className="badge-verified">
                      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                        <path
                          d="M3 6l2 2 4-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Verified
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative my-5">
                    <div className="absolute -left-6 sm:-left-8 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-surface-0" />
                    <div className="absolute -right-6 sm:-right-8 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-surface-0" />
                    <div className="border-t border-dashed border-white/[0.08]" />
                  </div>

                  {/* Agent address */}
                  <div className="mb-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                      Agent Address
                    </p>
                    <p className="font-mono text-sm text-white/80 break-all leading-relaxed">
                      {result.agent}
                    </p>
                  </div>

                  {/* ENS Name */}
                  {result.ensName && (
                    <div className="mb-4">
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                        ENS Identity
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm text-accent-light">
                          {result.ensName.replace(" (pending registration)", "")}
                        </p>
                        {result.ensName.includes("pending") && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber/20 bg-amber-muted px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chain info */}
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                        Chain
                      </p>
                      <p className="text-sm text-white/60">World Chain</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                        Status
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                        <p className="text-sm text-accent-light">Active</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action link */}
              {contractAddress && (
                <a
                  href={`https://worldscan.org/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-white/30 transition-all hover:border-white/[0.1] hover:text-white/50"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M6 3H3v10h10v-3"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 2h5v5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2L7 9"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  View Contract on WorldScan
                </a>
              )}
            </div>
          )}

          {/* Not verified result */}
          {result.status === "result" && !result.verified && (
            <div className="animate-scale-in glass-card p-6 sm:p-8">
              <div className="flex flex-col items-center text-center gap-5">
                {/* Icon */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber/20 bg-amber-muted">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-7 w-7 text-amber-400"
                  >
                    <path
                      d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 8v4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="15" r="1" fill="currentColor" />
                  </svg>
                </div>

                {/* Info */}
                <div>
                  <div className="badge-unverified mb-3">
                    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M6 4v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <circle cx="6" cy="8.5" r="0.6" fill="currentColor" />
                    </svg>
                    Not Verified
                  </div>
                  <p className="text-sm text-white/50 mb-1">
                    This agent has not been verified yet
                  </p>
                  <p className="font-mono text-xs text-white/25 break-all">
                    {result.agent}
                  </p>
                </div>

                {/* CTA */}
                <Link href="/widget" className="btn-primary px-6 py-3 text-sm mt-2">
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <path
                      d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 8l1.5 1.5L10.5 6"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Verify This Agent
                </Link>
              </div>
            </div>
          )}

          {/* Error state */}
          {result.status === "error" && (
            <div className="animate-scale-in glass-card p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/15">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-4 w-4 text-red-400"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M8 5v3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="8" cy="11" r="0.75" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Lookup Failed
                  </p>
                  <p className="mt-0.5 text-xs text-red-400/50 break-all">
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Idle state - empty */}
          {result.status === "idle" && (
            <div className="opacity-0 animate-fade-in fill-mode-forwards delay-400 text-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.01]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-7 w-7 text-white/10"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M16 16l4.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-white/20">
                    Enter an agent address to check verification status
                  </p>
                  <p className="text-xs text-white/10 mt-1">
                    Results are read directly from the World Chain contract
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contract transparency section */}
        <div className="w-full max-w-lg mt-12 opacity-0 animate-fade-in fill-mode-forwards delay-500">
          <div className="border-t border-white/[0.04] pt-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/15 mb-4 text-center">
              Contract Addresses
            </p>

            <div className="space-y-2">
              {contractAddress && (
                <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-3">
                  <div>
                    <p className="text-[11px] text-white/25">HumanGate</p>
                    <p className="font-mono text-xs text-white/40 mt-0.5">
                      {contractAddress}
                    </p>
                  </div>
                  <a
                    href={`https://worldscan.org/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/15 transition-colors hover:text-white/40"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                      <path
                        d="M6 3H3v10h10v-3"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 2h5v5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2L7 9"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </a>
                </div>
              )}

              {resolverAddress && (
                <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-3">
                  <div>
                    <p className="text-[11px] text-white/25">ENS Resolver</p>
                    <p className="font-mono text-xs text-white/40 mt-0.5">
                      {resolverAddress}
                    </p>
                  </div>
                  <a
                    href={`https://worldscan.org/address/${resolverAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/15 transition-colors hover:text-white/40"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                      <path
                        d="M6 3H3v10h10v-3"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 2h5v5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2L7 9"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </a>
                </div>
              )}

              {!contractAddress && !resolverAddress && (
                <p className="text-center text-xs text-white/15 py-2">
                  Contract addresses not configured in environment
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
