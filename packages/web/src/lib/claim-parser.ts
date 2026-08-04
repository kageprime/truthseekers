const CLAIM_REGEX = /\[claim:([a-f0-9-]+)\]/g;

export interface ClaimStatus {
  claim_id: string;
  text: string;
  status: "supported" | "disputed" | "weak" | "unknown";
  derived_confidence: number;
  confidence_vector: Record<string, number>;
}

export function parseClaimAnchors(text: string): { parts: { type: "text" | "claim"; value: string }[]; claimIds: string[] } {
  const parts: { type: "text" | "claim"; value: string }[] = [];
  const claimIds: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CLAIM_REGEX.lastIndex = 0;
  while ((match = CLAIM_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const cid = match[1];
    parts.push({ type: "claim", value: cid });
    claimIds.push(cid);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return { parts, claimIds };
}
