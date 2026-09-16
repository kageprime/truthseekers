"use client";

import { useState, useEffect, useCallback } from "react";
import { IconX } from "./Icons";
import { BASE } from "@/lib/constants";

interface ClaimDetail {
  id: string;
  text: string;
  type?: string;
  status?: string;
  derived_confidence?: number;
  confidence_vector?: Record<string, number>;
}

interface EvidenceItem {
  id: string;
  type: string;
  url?: string;
  acquisition_method?: string;
  supports_claim: boolean;
}

export default function EpistemicInspectorDrawer({
  slug,
  claimId,
  onClose,
}: {
  slug: string;
  claimId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [activeTab, setActiveTab] = useState<"passages" | "submit">("passages");

  // Form state
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchClaimDetails = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    setSubmitSuccess(false);
    try {
      const res = await fetch(`${BASE}/claims/${claimId}/evidence`);
      if (res.ok) {
        const data = await res.json();
        setClaim(data.claim ?? { id: claimId, text: `Claim ID: ${claimId}` });
        setEvidence(data.evidence ?? []);
      }
    } catch (e) {
      console.error("Failed to fetch claim details", e);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    if (claimId) {
      fetchClaimDetails();
    }
  }, [claimId, fetchClaimDetails]);

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimId || !submitUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/claims/${claimId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: submitUrl, note: submitNote, supports_claim: true }),
      });
      if (res.ok) {
        setSubmitSuccess(true);
        setSubmitUrl("");
        setSubmitNote("");
        fetchClaimDetails();
      }
    } catch (err) {
      console.error("Submit community evidence error", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!claimId) return null;

  const confidencePct = Math.round((claim?.derived_confidence ?? 0.85) * 100);
  const status = claim?.status ?? "supported";

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-lg h-full bg-[var(--surface-elevated)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--accent,#3b82f6)]/10 text-[var(--accent,#3b82f6)] border border-[var(--accent,#3b82f6)]/20">
              EPISTEMIC INSPECTOR
            </span>
            <span className="text-xs font-mono text-[var(--subtle)]">ID: {claimId}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--border)]/50 transition-colors text-[var(--subtle)] hover:text-[var(--foreground)]"
            aria-label="Close drawer"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center text-sm text-[var(--subtle)]">
            <p>Fetching epistemic provenance...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Claim Box */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[var(--subtle)]">
                  Factual Claim Statement
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  {status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--foreground)] leading-relaxed">
                "{claim?.text ?? "Extracting claim text..."}"
              </p>

              {/* Confidence Meter */}
              <div className="mt-4 pt-3 border-t border-[var(--border)]/40 flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-[var(--subtle)]">Derived Confidence:</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-[var(--border)] overflow-hidden">
                    <div className="h-full bg-[var(--accent,#3b82f6)]" style={{ width: `${confidencePct}%` }} />
                  </div>
                  <span className="font-mono font-bold text-[var(--foreground)]">{confidencePct}%</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
              <button
                onClick={() => setActiveTab("passages")}
                className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === "passages"
                    ? "border-[var(--accent,#3b82f6)] text-[var(--accent,#3b82f6)] font-bold"
                    : "border-transparent text-[var(--subtle)] hover:text-[var(--foreground)]"
                }`}
              >
                Supporting Passages ({evidence.length})
              </button>
              <button
                onClick={() => setActiveTab("submit")}
                className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === "submit"
                    ? "border-[var(--accent,#3b82f6)] text-[var(--accent,#3b82f6)] font-bold"
                    : "border-transparent text-[var(--subtle)] hover:text-[var(--foreground)]"
                }`}
              >
                Submit Evidence +
              </button>
            </div>

            {/* Tab 1: Passages */}
            {activeTab === "passages" && (
              <div className="space-y-3">
                {evidence.length === 0 ? (
                  <p className="text-xs text-[var(--subtle)] italic">No raw source passages attached to this claim ID.</p>
                ) : (
                  evidence.map((ev, i) => (
                    <div key={ev.id || i} className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] uppercase font-bold text-[var(--accent,#3b82f6)]">
                          {ev.type || "primary_source"}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {ev.supports_claim ? "✓ Supports Claim" : "⚡ Counter-Evidence"}
                        </span>
                      </div>
                      {ev.url && (
                        <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[var(--accent,#3b82f6)] hover:underline truncate block my-1">
                          {ev.url} ↗
                        </a>
                      )}
                      <p className="text-[11px] text-[var(--subtle)] font-mono">
                        Acquisition: {ev.acquisition_method || "automated_retrieval"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Community Submission Form */}
            {activeTab === "submit" && (
              <form onSubmit={handleSubmitEvidence} className="space-y-3 text-xs">
                <div>
                  <label className="block font-mono text-[11px] font-bold text-[var(--foreground)] mb-1">
                    Primary Source URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://archive.org/... or https://doi.org/..."
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent,#3b82f6)]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] font-bold text-[var(--foreground)] mb-1">
                    Evidence Context & Note
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Explain how this primary document supports or contests the claim..."
                    value={submitNote}
                    onChange={(e) => setSubmitNote(e.target.value)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent,#3b82f6)] resize-none"
                  />
                </div>

                {submitSuccess && (
                  <p className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                    ✓ Evidence submitted! It has been queued for verification.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded bg-[var(--accent,#3b82f6)] py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? "Submitting Evidence..." : "Submit Evidence for Verification"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
