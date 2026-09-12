const CLAIM_REGEX = /\[claim:([a-f0-9-]+)\]/g;

export interface ClaimStatus {
  claim_id: string;
  text: string;
  status: "supported" | "disputed" | "weak" | "unknown";
  derived_confidence: number;
  confidence_vector: Record<string, number>;
}

export function parseClaimAnchors(text: string): { parts: { type: "text" | "claim"; value: string }[]; claimIds: string[] } {  const parts: { type: "text" | "claim"; value: string }[] = [];
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

// collectAnchorNumbers walks blocks in reading order (including nested
// section children) and numbers each distinct anchor for citation display.
export function collectAnchorNumbers(blocks: Array<{ type?: string; data?: any }> | undefined | null): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 0;
  const visit = (list: Array<{ type?: string; data?: any }> | undefined | null) => {
    if (!Array.isArray(list)) return;
    for (const b of list) {
      if (!b) continue;
      if (b.type === "text" && b.data) {
        const content = b.data.content || b.data.text || "";
        if (typeof content === "string") {
          for (const id of parseClaimAnchors(content).claimIds) {
            if (!(id in map)) map[id] = ++n;
          }
        }
      }
      if (b.type === "section" && b.data && Array.isArray(b.data.blocks)) visit(b.data.blocks);
    }
  };
  visit(blocks);
  return map;
}

// stripClaimAnchors removes anchor markers for contexts that render no chips
// (deck, previews) so raw [claim:…] text never reaches readers.
export function stripClaimAnchors(text: string): string {
  if (!text) return "";
  CLAIM_REGEX.lastIndex = 0;
  return text.replace(CLAIM_REGEX, "").replace(/\s{2,}/g, " ").trim();
}
