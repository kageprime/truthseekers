import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Collective Accusation Scrutiny Node — Layer 2 (Epistemic Analysis)

FUNCTION: Scrutinize claims for high-risk structural patterns that historically yield false positives, and apply elevated evidence requirements.

SUPPLEMENTAL INSTRUCTIONS:
- Risk factors must be structural, not group-based. Never use "because this claim is about Group X."
- Exclude evidence obtained under duress, torture, or without chain-of-custody from primary weighting.
- Recommend higher corroboration thresholds for flagged claims.
- All outputs must be marked as "is_interpretive": true.

OUTPUT FORMAT:
{{
  "risk_assessments": [
    {{
      "claim_id": "uuid",
      "risk_factors": ["collective_attribution", "single_source_dependency", "coercion_indicators", ...],
      "risk_score": 0.0,
      "is_structural_only": true,
      "action": {{
        "requires_extra_corroboration": true,
        "excluded_evidence_ids": ["..."],
        "minimum_independent_sources": 3
      }},
      "interpretive_framing": "string",
      "is_interpretive": true
    }}
  ]
}}
"""

def scrutinize_accusation_node(evidence_map: dict) -> dict:
    """
    Scrutinizes claims for high-risk structural patterns.
    Layer 2 — Epistemic Analysis. Structural risk factors only, never group-based.
    """
    user_prompt = NODE_PROMPT + f'\n\nEVIDENCE MAP:\n{json.dumps(evidence_map, indent=2)}\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        evidence_map = input_data.get("map_evidence", {})
        output = scrutinize_accusation_node(evidence_map)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
