"use client";

import { useState, useEffect } from "react";
import { IDKitRequestWidget, orbLegacy, type RpContext } from "@worldcoin/idkit";

type Status =
  | { step: "idle" }
  | { step: "verifying" }
  | { step: "success"; txHash: string; sessionToken: string }
  | { step: "error"; message: string };

export default function WidgetPage() {
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx") as `app_${string}`;

  // Fetch RP signature from backend when agent ID is set
  useEffect(() => {
    if (!agentId) return;

    fetch("/api/rp-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-agent" }),
    })
      .then((r) => r.json())
      .then((data) => {
        setRpContext({
          rp_id: data.rp_id,
          nonce: data.nonce,
          created_at: data.created_at,
          expires_at: data.expires_at,
          signature: data.sig,
        });
      })
      .catch(() => {
        // RP signature not configured — widget will still render
        // but verification will use developer portal fallback
      });
  }, [agentId]);

  async function handleVerify(result: any) {
    setStatus({ step: "verifying" });

    try {
      // Extract legacy proof fields from v4 response
      const response = result.responses?.[0] ?? result;
      const proof = {
        merkle_root: response.merkle_root,
        nullifier_hash: response.nullifier,
        proof: response.proof,
      };

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof, agentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({ step: "error", message: data.error ?? "Verification failed" });
        return;
      }

      setStatus({
        step: "success",
        txHash: data.txHash,
        sessionToken: data.sessionToken,
      });
    } catch (err: any) {
      setStatus({ step: "error", message: err.message });
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 gap-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">HumanGate Verification</h1>
          <p className="text-sm text-gray-400 mt-1">
            Prove your agent is backed by a real human.
          </p>
        </div>

        <div>
          <label htmlFor="agentId" className="block text-sm font-medium text-gray-300 mb-1">
            Agent Address
          </label>
          <input
            id="agentId"
            type="text"
            placeholder="0x..."
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
          />
        </div>

        {agentId && !rpContext && (
          <p className="text-sm text-gray-500 text-center">Loading verification...</p>
        )}

        {agentId && rpContext && (
          <>
            <button
              onClick={() => setOpen(true)}
              disabled={status.step === "verifying"}
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50"
            >
              {status.step === "verifying" ? "Verifying..." : "Verify with World ID"}
            </button>

            <IDKitRequestWidget
              open={open}
              onOpenChange={setOpen}
              app_id={appId}
              action="verify-agent"
              rp_context={rpContext}
              allow_legacy_proofs
              preset={orbLegacy({ signal: agentId })}
              environment="staging"
              handleVerify={handleVerify}
              onSuccess={() => {}}
              onError={(code) =>
                setStatus({ step: "error", message: `IDKit error: ${code}` })
              }
            />
          </>
        )}

        {status.step === "success" && (
          <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-2">
            <p className="text-green-400 font-medium">Agent verified on-chain</p>
            <p className="text-xs text-gray-400 break-all">tx: {status.txHash}</p>
            <div>
              <p className="text-xs text-gray-400 mb-1">Session token:</p>
              <code className="block text-xs bg-gray-900 p-2 rounded break-all">
                {status.sessionToken}
              </code>
            </div>
          </div>
        )}

        {status.step === "error" && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-400 text-sm">{status.message}</p>
          </div>
        )}
      </div>
    </main>
  );
}
