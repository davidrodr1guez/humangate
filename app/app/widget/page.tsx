"use client";

import { useState, useEffect } from "react";
import { IDKitRequestWidget, orbLegacy, type RpContext } from "@worldcoin/idkit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Status =
  | { step: "idle" }
  | { step: "verifying" }
  | {
      step: "success";
      txHash: string;
      sessionToken: string;
      pass?: { signature: string; expiresAt: number };
    }
  | { step: "error"; message: string };

/* ------------------------------------------------------------------ */
/* Helper: truncate long hex strings                                   */
/* ------------------------------------------------------------------ */

function truncateHex(hex: string, front = 10, back = 8): string {
  if (hex.length <= front + back + 3) return hex;
  return `${hex.slice(0, front)}...${hex.slice(-back)}`;
}

/* ------------------------------------------------------------------ */
/* Step Indicator                                                      */
/* ------------------------------------------------------------------ */

function StepIndicator({
  currentStep,
}: {
  currentStep: 1 | 2 | 3;
}) {
  const steps = [
    { num: 1, label: "Agent ID" },
    { num: 2, label: "Verify" },
    { num: 3, label: "Pass Issued" },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((s, i) => {
        const isActive = s.num === currentStep;
        const isComplete = s.num < currentStep;
        return (
          <div key={s.num} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={`
                  relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-500
                  ${
                    isComplete
                      ? "bg-accent text-white shadow-[0_0_16px_rgba(16,185,129,0.3)]"
                      : isActive
                        ? "border-2 border-accent text-accent bg-accent/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "border border-white/[0.08] text-white/20 bg-white/[0.02]"
                  }
                `}
              >
                {isComplete ? (
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <path
                      d="M4 8l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  s.num
                )}
                {isActive && (
                  <div className="absolute inset-0 rounded-full border-2 border-accent animate-pulse-ring" />
                )}
              </div>
              <span
                className={`text-[11px] font-medium transition-colors duration-300 ${
                  isActive || isComplete ? "text-white/70" : "text-white/20"
                }`}
              >
                {s.label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div className="mx-3 mb-6 h-[2px] w-12 sm:w-16 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isComplete
                      ? "w-full bg-gradient-to-r from-accent to-accent-light"
                      : "w-0 bg-accent"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Verification Spinner                                                */
/* ------------------------------------------------------------------ */

function VerifyingSpinner() {
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-accent">
            <path
              d="M12 2L4 6.5v5c0 5.55 3.42 10.74 8 12 4.58-1.26 8-6.45 8-12v-5L12 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/80">Verifying on-chain</p>
        <p className="text-xs text-white/30 mt-1">
          Writing proof to World Chain...
        </p>
      </div>
      {/* Pulsing glow bar */}
      <div className="w-48 h-1 rounded-full overflow-hidden bg-white/[0.04]">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-shimmer bg-200%" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pass Credential Card                                                */
/* ------------------------------------------------------------------ */

function PassCard({
  agentId,
  txHash,
  sessionToken,
  pass,
}: {
  agentId: string;
  txHash: string;
  sessionToken: string;
  pass?: { signature: string; expiresAt: number };
}) {
  const ensName = `${agentId.toLowerCase()}.humanbacked.eth`;
  const expiryDate = pass?.expiresAt
    ? new Date(pass.expiresAt * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Permanent";

  return (
    <div className="animate-scale-in">
      <div className="pass-card glow-accent p-0">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-accent/0 via-accent to-accent/0" />

        <div className="relative z-10 p-6 sm:p-8">
          {/* Header row */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              {/* Shield icon */}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 border border-accent/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-accent-light"
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
                <p className="text-sm font-semibold text-white">HumanGate Pass</p>
                <p className="text-[11px] text-accent-light/60">
                  Verified Agent Credential
                </p>
              </div>
            </div>

            {/* Verified badge */}
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

          {/* Divider - dashed like a ticket */}
          <div className="relative my-5">
            <div className="absolute -left-6 sm:-left-8 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-surface-0" />
            <div className="absolute -right-6 sm:-right-8 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-surface-0" />
            <div className="border-t border-dashed border-white/[0.08]" />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Agent */}
            <div className="col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                Agent Address
              </p>
              <p className="font-mono text-sm text-white/80 break-all leading-relaxed">
                {agentId}
              </p>
            </div>

            {/* ENS Name */}
            <div className="col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                ENS Identity
              </p>
              <p className="font-mono text-sm text-accent-light">
                {ensName}
              </p>
            </div>

            {/* Expiry */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                Valid Until
              </p>
              <p className="text-sm text-white/70">{expiryDate}</p>
            </div>

            {/* Chain */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                Chain
              </p>
              <p className="text-sm text-white/70">World Chain</p>
            </div>
          </div>

          {/* Second dashed divider */}
          <div className="relative my-5">
            <div className="absolute -left-6 sm:-left-8 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-surface-0" />
            <div className="absolute -right-6 sm:-right-8 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-surface-0" />
            <div className="border-t border-dashed border-white/[0.08]" />
          </div>

          {/* Transaction hash */}
          <div className="mb-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
              Transaction
            </p>
            <p className="font-mono text-xs text-white/40 break-all">
              {txHash}
            </p>
          </div>

          {/* Pass Signature */}
          {pass?.signature && (
            <div className="mb-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
                Pass Signature
              </p>
              <p className="font-mono text-xs text-white/40 break-all">
                {truncateHex(pass.signature, 16, 12)}
              </p>
            </div>
          )}

          {/* Session Token */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25 mb-1.5">
              Session Token
            </p>
            <div className="rounded-lg bg-black/30 border border-white/[0.04] p-3">
              <code className="block font-mono text-[11px] text-white/40 break-all leading-relaxed">
                {sessionToken}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Widget Page                                                    */
/* ------------------------------------------------------------------ */

export default function WidgetPage() {
  const [agentId, setAgentId] = useState("");
  const [agentLabel, setAgentLabel] = useState("");
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx") as `app_${string}`;

  const [ready, setReady] = useState(false);

  // Derive the current step for the indicator
  const currentStep: 1 | 2 | 3 =
    status.step === "success"
      ? 3
      : agentId && ready
        ? 2
        : 1;

  // Fetch RP signature from backend when agent ID is set
  useEffect(() => {
    if (!agentId) {
      setReady(false);
      return;
    }

    fetch("/api/rp-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-agent-v7" }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("RP not configured");
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
        setReady(true);
      })
      .catch(() => {
        // RP signature not configured — proceed without it
        setReady(true);
      });
  }, [agentId]);

  async function handleVerify(result: any) {
    setStatus({ step: "verifying" });

    try {
      // Send full IDKit payload for cloud verification + legacy proof as fallback
      const response = result.responses?.[0] ?? result;
      const proof = {
        merkle_root: response.merkle_root,
        nullifier_hash: response.nullifier_hash ?? response.nullifier,
        proof: response.proof,
      };

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof,
          agentId,
          agentLabel: agentLabel || undefined,
          idkitPayload: result,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({
          step: "error",
          message: data.error ?? "Verification failed",
        });
        return;
      }

      setStatus({
        step: "success",
        txHash: data.txHash,
        sessionToken: data.sessionToken,
        pass: data.pass,
      });
    } catch (err: any) {
      setStatus({ step: "error", message: err.message });
    }
  }

  return (
    <main className="relative min-h-screen">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/[0.03] rounded-full blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-8 sm:pt-16 pb-32">
        {/* Page header */}
        <div className="text-center mb-8 opacity-0 animate-fade-in-up fill-mode-forwards">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-1.5 mb-4">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-accent">
              <path
                d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-xs text-white/40">Agent Verification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Verify Your Agent
          </h1>
          <p className="mt-2 text-sm text-white/30 max-w-sm mx-auto">
            Prove your agent is backed by a real human using World ID
          </p>
        </div>

        {/* Stepper */}
        <div className="opacity-0 animate-fade-in fill-mode-forwards delay-200">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Card */}
        <div className="w-full max-w-lg opacity-0 animate-fade-in-up fill-mode-forwards delay-300">
          <div className="glass-card p-6 sm:p-8">
            {/* Step 1: Agent input */}
            {status.step !== "success" && (
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="agentId"
                    className="block text-[11px] font-medium uppercase tracking-[0.15em] text-white/30 mb-2"
                  >
                    Agent Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/15">
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                        <rect
                          x="2"
                          y="4"
                          width="12"
                          height="8"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <path
                          d="M5 4V3a3 3 0 116 0v1"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <input
                      id="agentId"
                      type="text"
                      placeholder="0x..."
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      className="input-field pl-10 font-mono text-sm"
                      disabled={status.step === "verifying"}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/15">
                    The Ethereum address of the AI agent to verify
                  </p>
                </div>

                {/* Agent name */}
                <div>
                  <label
                    htmlFor="agentLabel"
                    className="block text-[11px] font-medium uppercase tracking-[0.15em] text-white/30 mb-2"
                  >
                    Agent Name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/15">
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                        <path
                          d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <input
                      id="agentLabel"
                      type="text"
                      placeholder="mybot"
                      value={agentLabel}
                      onChange={(e) => setAgentLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="input-field pl-10 text-sm"
                      disabled={status.step === "verifying"}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/15">
                    {agentLabel
                      ? <span className="text-accent/50">{agentLabel}.humanbacked.eth</span>
                      : "Choose a human-readable name for your agent"}
                  </p>
                </div>

                {/* Loading RP context */}
                {agentId && !ready && status.step !== "verifying" && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="h-3.5 w-3.5 rounded-full border border-white/10 border-t-white/40 animate-spin" />
                    <span className="text-xs text-white/25">
                      Preparing verification...
                    </span>
                  </div>
                )}

                {/* Verifying spinner */}
                {status.step === "verifying" && <VerifyingSpinner />}

                {/* Verify button */}
                {agentId && ready && status.step !== "verifying" && (
                  <button
                    onClick={() => setOpen(true)}
                    className="btn-primary w-full py-4 text-sm sticky bottom-4"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-5 w-5"
                    >
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="10"
                        cy="10"
                        r="3"
                        fill="currentColor"
                        opacity="0.4"
                      />
                    </svg>
                    Verify with World ID
                  </button>
                )}

                {/* IDKit Widget (invisible until triggered) */}
                {agentId && ready && (
                  <IDKitRequestWidget
                    open={open}
                    onOpenChange={setOpen}
                    app_id={appId}
                    action="verify-agent-v7"
                    rp_context={rpContext ?? { rp_id: "", nonce: "", created_at: 0, expires_at: 0, signature: "" }}
                    allow_legacy_proofs
                    preset={orbLegacy({ signal: agentId })}
                    environment="production"
                    handleVerify={handleVerify}
                    onSuccess={() => {}}
                    onError={(code) =>
                      setStatus({
                        step: "error",
                        message: `IDKit error: ${code}`,
                      })
                    }
                  />
                )}

                {/* Error display */}
                {status.step === "error" && (
                  <div className="animate-scale-in rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
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
                          <circle
                            cx="8"
                            cy="11"
                            r="0.75"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-400">
                          Verification Failed
                        </p>
                        <p className="mt-0.5 text-xs text-red-400/60">
                          {status.message}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setStatus({ step: "idle" })}
                      className="mt-3 w-full rounded-lg border border-red-500/10 bg-red-500/[0.04] px-3 py-2 text-xs font-medium text-red-400/80 transition-colors hover:bg-red-500/[0.08]"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Success - Pass Card */}
            {status.step === "success" && (
              <div className="space-y-6">
                {/* Success banner */}
                <div className="flex items-center gap-3 rounded-xl bg-accent/[0.06] border border-accent/15 p-4 animate-fade-in-down">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-4.5 w-4.5 text-accent-light"
                    >
                      <path
                        d="M4 8l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-accent-light">
                      Agent Verified Successfully
                    </p>
                    <p className="text-[11px] text-accent/50">
                      On-chain proof recorded on World Chain
                    </p>
                  </div>
                </div>

                {/* The pass card */}
                <PassCard
                  agentId={agentId}
                  txHash={status.txHash}
                  sessionToken={status.sessionToken}
                  pass={status.pass}
                />

                {/* Action to verify another */}
                <button
                  onClick={() => {
                    setAgentId("");
                    setStatus({ step: "idle" });
                    setRpContext(null);
                  }}
                  className="btn-secondary w-full py-3 text-xs"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M2 8a6 6 0 1011.46-2.46"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 2v4h-4"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Verify Another Agent
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
