# VERITAS Epistemic Layer Contract
## Version 1.0 — Formal RFC
### Stratified I/O Contracts, Permissions, Prohibitions & Failure Modes

**Status:** Active  
**Governance:** VERITAS Epistemic Commitment Statement V1.0  
**Depends On:** System Design V1.3  
**Audience:** Implementors. This is enforceable at the code level.

---

## 1. The Layer Separation Rule

VERITAS is a stratified epistemic pipeline. No layer may perform the functions of another layer. Cross-layer inference leakage is the primary failure mode this contract prevents.

```
┌──────────────────────────────────────────────┐
│  LAYER 3: Knowledge Construction             │
│  Permissions: Synthesize, narrate, resolve   │
│  Prohibited: Re-inventing evidence structure │
│  Input must trace to Layer 2 outputs         │
└──────────────────────────────────────────────┘
                    ▲
                    │  Only via typed contracts
                    │
┌──────────────────────────────────────────────┐
│  LAYER 2: Epistemic Analysis                 │
│  Permissions: Interpret, flag, map, score    │
│  Prohibited: Assigning causality without     │
│  external metadata from Layer 1              │
│  All outputs labeled as interpretive         │
└──────────────────────────────────────────────┘
                    ▲
                    │  Only via typed contracts
                    │
┌──────────────────────────────────────────────┐
│  LAYER 1: Evidence Integrity                 │
│  Permissions: Detect, tag, classify, retrieve│
│  Prohibited: Interpretation, causality,      │
│  euphemism correction, suppression claims    │
│  Fully falsifiable, externally verifiable    │
└──────────────────────────────────────────────┘
```

---

## 2. Layer 1 — Evidence Integrity

### 2.1 Permissions

| Action | Allowed? | Constraint |
| --- | --- | --- |
| Detect evidence presence/absence | Binary: found / not_found | |
| Tag evidence type | Must use enumerated types | |
| Classify uncertainty | verified_gap / unverified_gap / false_positive_risk | |
| Retrieve from all truth categories | confirmed, contested, suppressed, speculative | |
| Tag chain of custody | verified / partial / unverified | |
| Tag acquisition method | public / foia / leak / classified_release / unknown | |
| Tag accessibility | public / restricted / classified / destroyed | |

### 2.2 Prohibitions

| Action | Prohibited? | Reason |
| --- | --- | --- |
| Assign causality to absence | "Gap ≠ suppression" | must be a type constraint |
| Interpret meaning of a gap | Layer 2's job | |
| Correct euphemisms | Layer 2's job | |
| Score source credibility | Layer 2's job | |
| Claim "this was suppressed" | Requires Layer 2 interpretive step + external metadata | |
| Infer intent | Not falsifiable | |

### 2.3 Output Contract

```json
{
    "layer": 1,
    "output_type": "evidence_record",
    "evidence": [
        {
            "evidence_id": "uuid",
            "type": "primary_document | eyewitness | expert_analysis | leaked | patent | dataset | anonymous",
            "presence": "found | not_found",
            "url": "string | null",
            "chain_of_custody": "verified | partial | unverified",
            "acquisition_method": "public | foia | leak | classified_release | unknown",
            "accessibility": "public | restricted | classified | destroyed",
            "source_doc_id": "uuid",
            "content_snippet": "string | null",
            "gap_metadata": {
                "gap_type": "expected | unexpected | unknown_expectedness | null"
            }
        }
    ]
}
```
