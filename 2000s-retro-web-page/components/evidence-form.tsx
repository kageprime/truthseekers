"use client";

import Link from "next/link";
import { useState } from "react";
import { fetchClaimEvidence, submitClaimEvidence } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "./auth-provider";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

// ponytail: one component owns the whole evidence loop — list what Veritas
// has, submit counter-evidence when logged in. Static demo claims (C-001…)
// render nothing; only real backend claim ids qualify.
export function EvidenceForm({ claimId }: { claimId: string }) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = UUID_RE.test(claimId);
  const evidence = useApi((signal) => fetchClaimEvidence(claimId, signal), `evidence:${claimId}`);

  if (!live) return null;

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await submitClaimEvidence(claimId, url.trim(), note.trim());
    setBusy(false);
    if (res) {
      setMsg("Submitted — Veritas will verify it against the claim.");
      setUrl("");
      setNote("");
      evidence.refetch();
    } else {
      setMsg(user ? "Submission failed — try again." : "Log in to submit evidence.");
    }
  };

  return (
    <div className="mt-8 border-t border-paper/20 pt-6">
      <p className="font-mono text-[10px] uppercase text-coral">Evidence / live</p>
      {evidence.data && evidence.data.evidence.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {evidence.data.evidence.slice(0, 5).map((e) => (
            <li key={e.id} className="border border-paper/20 p-3">
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="break-all font-serif text-base text-paper/85 hover:text-coral"
              >
                {e.url}
              </a>
              <p className="mt-1 font-mono text-[9px] uppercase text-paper/50">
                {e.supports_claim ? "Supports" : "Contradicts"} · {e.chain_of_custody ?? "unverified"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 font-serif text-base text-paper/60">No evidence attached yet — be the first to file some.</p>
      )}
      {user ? (
        <div className="mt-5 space-y-3">
          <input
            aria-label="Evidence URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://source…"
            inputMode="url"
            className="w-full border border-paper/25 bg-transparent px-3 py-2 font-mono text-xs text-paper outline-none placeholder:text-paper/35 focus:border-coral"
          />
          <input
            aria-label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this matters (optional)"
            className="w-full border border-paper/25 bg-transparent px-3 py-2 font-mono text-xs text-paper outline-none placeholder:text-paper/35 focus:border-coral"
          />
          <button
            disabled={busy || !url.trim()}
            onClick={submit}
            className="border border-coral px-4 py-2 font-mono text-[10px] uppercase text-coral hover:bg-coral hover:text-ink disabled:opacity-40"
          >
            {busy ? "Filing…" : "Submit counter-evidence"}
          </button>
        </div>
      ) : (
        <Link
          href="/login?redirect=/claims"
          className="mt-5 inline-block border border-coral px-4 py-2 font-mono text-[10px] uppercase text-coral hover:bg-coral hover:text-ink"
        >
          Log in to submit evidence
        </Link>
      )}
      {msg && <p className="mt-3 font-mono text-[10px] uppercase text-paper/70">{msg}</p>}
    </div>
  );
}
