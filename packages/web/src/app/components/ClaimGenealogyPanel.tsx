"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ClaimGraphNode, ClaimGraphEdge } from "@/lib/api";
import ConfidenceRadar from "./ConfidenceRadar";

const STATUS_COLOR: Record<string, string> = {
  supported: "#2b7a4b",
  weak: "#b87a2e",
  disputed: "#b33c3c",
  unknown: "#8a8a8a",
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function chainLabel(chain: string): { text: string; color: string } {
  switch (chain) {
    case "verified": return { text: "Verified chain", color: "#2b7a4b" };
    case "partial": return { text: "Partial chain", color: "#b87a2e" };
    case "unverified": return { text: "Unverified chain", color: "#b33c3c" };
    default: return { text: chain, color: "#8a8a8a" };
  }
}

function accessLabel(access: string): { text: string; color: string } {
  switch (access) {
    case "public": return { text: "Public", color: "#2b7a4b" };
    case "restricted": return { text: "Restricted", color: "#b87a2e" };
    case "classified": return { text: "Classified", color: "#b33c3c" };
    case "destroyed": return { text: "Destroyed", color: "#b33c3c" };
    default: return { text: access, color: "#8a8a8a" };
  }
}

interface Props {
  claim: ClaimGraphNode;
  nodes: ClaimGraphNode[];
  edges: ClaimGraphEdge[];
  onSelectClaim: (claimId: string) => void;
  onClose: () => void;
}

export default function ClaimGenealogyPanel({ claim, nodes, edges, onSelectClaim, onClose }: Props) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const { supporting, contradicting, supportingClaims, contradictingClaims, relatedClaims } = useMemo(() => {
    const sup: ClaimGraphNode[] = [];
    const con: ClaimGraphNode[] = [];
    const supClaims: { node: ClaimGraphNode; strength?: number }[] = [];
    const conClaims: { node: ClaimGraphNode; strength?: number }[] = [];
    const relClaims: { node: ClaimGraphNode; strength?: number }[] = [];

    for (const e of edges) {
      if (e.type === "evidence" && e.target === claim.id) {
        const ev = nodeMap.get(e.source);
        if (ev) {
          if (e.relationship === "supports") sup.push(ev);
          else if (e.relationship === "contradicts") con.push(ev);
        }
      }
      if (e.type === "claim") {
        const isSource = e.source === claim.id;
        const otherId = isSource ? e.target : e.source;
        const other = nodeMap.get(otherId);
        if (!other) continue;
        const entry = { node: other, strength: e.strength };
        if (e.relationship === "supports") {
          if (isSource) supClaims.push(entry); else supClaims.push(entry);
        } else if (e.relationship === "contradicts") {
          if (isSource) conClaims.push(entry); else conClaims.push(entry);
        } else if (e.relationship === "related") {
          relClaims.push(entry);
        }
      }
    }
    return {
      supporting: sup,
      contradicting: con,
      supportingClaims: supClaims,
      contradictingClaims: conClaims,
      relatedClaims: relClaims,
    };
  }, [claim.id, edges, nodeMap]);

  const statusColor = STATUS_COLOR[claim.status || "unknown"] || STATUS_COLOR.unknown;
  const articleSlug = (claim as any).article_slug as string | undefined;

  return (
    <div
      className="bezel animate-appear-up"
      style={{ maxHeight: "70vh", overflow: "hidden" }}
    >
      <div
        className="bezel-inner flex flex-col"
        style={{ maxHeight: "70vh", borderRadius: "calc(2.5rem - 2px)" }}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b" style={{ borderColor: "var(--border-light)" }}>
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <ConfidenceRadar vector={claim.confidence_vector} size={88} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="small-caps text-[10px] tracking-[0.14em] rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    background: statusColor + "1f",
                    color: statusColor,
                    border: "1px solid " + statusColor + "55",
                  }}
                >
                  {claim.status || "unknown"}
                </span>
                {claim.confidence != null && (
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
                    conf {(claim.confidence as number).toFixed(2)}
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="ml-auto text-[10px] cursor-pointer transition-opacity hover:opacity-60"
                  style={{ color: "var(--subtle)", background: "none", border: "none" }}
                >
                  ✕
                </button>
              </div>
              <p className="font-display text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
                {claim.label || claim.id}
              </p>
              {articleSlug && (
                <Link
                  href={`/article/${articleSlug}`}
                  className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium no-underline hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  Read in context
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable genealogy body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Confidence vector bars */}
          {claim.confidence_vector && (
            <div>
              <SectionLabel>Confidence Vector</SectionLabel>
              <div className="space-y-1.5">
                {Object.entries(claim.confidence_vector).map(([k, v]) => (
                  <VectorBar key={k} label={k.replace(/_/g, " ")} value={v as number} color={statusColor} />
                ))}
              </div>
            </div>
          )}

          {/* Supporting evidence */}
          {supporting.length > 0 && (
            <div>
              <SectionLabel color="#2b7a4b">
                <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ background: "#2b7a4b" }} />
                Supporting Evidence · {supporting.length}
              </SectionLabel>
              <div className="space-y-2">
                {supporting.map((ev) => (
                  <EvidenceCard key={ev.id} node={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Contradicting evidence */}
          {contradicting.length > 0 && (
            <div>
              <SectionLabel color="#b33c3c">
                <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ background: "#b33c3c" }} />
                Contradicting Evidence · {contradicting.length}
              </SectionLabel>
              <div className="space-y-2">
                {contradicting.map((ev) => (
                  <EvidenceCard key={ev.id} node={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Claim relationships */}
          {(supportingClaims.length > 0 || contradictingClaims.length > 0 || relatedClaims.length > 0) && (
            <div>
              <SectionLabel>Claim Relationships</SectionLabel>
              <div className="space-y-1.5">
                {supportingClaims.map(({ node, strength }) => (
                  <ClaimLink key={node.id} node={node} rel="supports" strength={strength} onSelect={onSelectClaim} />
                ))}
                {contradictingClaims.map(({ node, strength }) => (
                  <ClaimLink key={node.id} node={node} rel="contradicts" strength={strength} onSelect={onSelectClaim} />
                ))}
                {relatedClaims.map(({ node, strength }) => (
                  <ClaimLink key={node.id} node={node} rel="related" strength={strength} onSelect={onSelectClaim} />
                ))}
              </div>
            </div>
          )}

          {supporting.length === 0 && contradicting.length === 0 && supportingClaims.length === 0 && contradictingClaims.length === 0 && relatedClaims.length === 0 && (
            <div className="py-8 text-center text-xs" style={{ color: "var(--subtle)" }}>
              No traceability links recorded for this claim yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2.5 flex items-center" style={{ color: color || "var(--subtle)" }}>
      {children}
    </div>
  );
}

function VectorBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] capitalize w-24 flex-shrink-0 truncate" style={{ color: "var(--muted)" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color, transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }} />
      </div>
      <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: "var(--muted)" }}>{(value || 0).toFixed(2)}</span>
    </div>
  );
}

function EvidenceCard({ node }: { node: ClaimGraphNode }) {
  const url = node.label || "";
  const chain = chainLabel((node as any).chain_of_custody || "unverified");
  const access = accessLabel((node as any).accessibility || "public");
  const supports = (node as any).supports;

  return (
    <a
      href={url.startsWith("http") ? url : undefined}
      target={url.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="block no-underline group"
    >
      <div
        className="p-2.5 rounded-lg border transition-all duration-300 hover:-translate-y-px"
        style={{
          borderColor: "var(--border-light)",
          background: "var(--surface)",
          boxShadow: `inset 3px 0 0 0 ${supports ? "#2b7a4b" : "#b33c3c"}`,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5"
            style={{
              background: (supports ? "#2b7a4b" : "#b33c3c") + "14",
              color: supports ? "#2b7a4b" : "#b33c3c",
            }}
          >
            {supports ? "Supports" : "Contradicts"}
          </span>
          <span className="text-[9px] font-medium" style={{ color: chain.color }}>{chain.text}</span>
          <span className="text-[9px]" style={{ color: "var(--subtle)" }}>· {access.text}</span>
        </div>
        <div className="text-[11px] font-mono truncate group-hover:text-ink transition-colors" style={{ color: "var(--muted)" }}>
          {domainOf(url)}
        </div>
        <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--subtle)" }}>{url}</div>
      </div>
    </a>
  );
}

function ClaimLink({ node, rel, strength, onSelect }: {
  node: ClaimGraphNode;
  rel: string;
  strength?: number;
  onSelect: (id: string) => void;
}) {
  const color = rel === "supports" ? "#2b7a4b" : rel === "contradicts" ? "#b33c3c" : "#8a8a8a";
  return (
    <button
      onClick={() => onSelect(node.id)}
      className="w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-lg border transition-all duration-300 hover:-translate-y-px cursor-pointer"
      style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
    >
      <span
        className="text-[9px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5 shrink-0 mt-0.5"
        style={{ background: color + "14", color }}
      >
        {rel}
      </span>
      <span className="text-[11px] leading-relaxed flex-1 min-w-0" style={{ color: "var(--ink-secondary)" }}>
        {node.label?.slice(0, 120) || node.id}
        {node.label && node.label.length > 120 ? "…" : ""}
      </span>
      {strength != null && (
        <span className="text-[9px] tabular-nums shrink-0 mt-0.5" style={{ color: "var(--subtle)" }}>{strength.toFixed(2)}</span>
      )}
    </button>
  );
}