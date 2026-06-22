import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Missing Evidence Detector — Layer 2 (Epistemic Analysis)

FUNCTION: Analyze gaps in the evidentiary record, classify them, and provide interpretive hypotheses where metadata supports them.

SUPPLEMENTAL INSTRUCTIONS:
- You may populate cause_label ONLY if external_metadata is not null and directly supports the label (e.g., a secrecy order number).
- Always mark is_interpretive: true when you provide a cause_label or interpretive framing.
- Frame as "consistent with suppression pattern," NOT as "this was suppressed."
- Risk scoring must be structural, never categorical.

OUTPUT FORMAT:
{{
  "gaps": [
    {{
      "evidence_id": "uuid",
      "gap_type": "expected | unexpected | unknown_expectedness",
      "expected_artifact": "patent | primary_source | dataset | eyewitness",
      "verification_status": "verified_gap | unverified_gap | false_positive_risk",
      "external_metadata": "string | null",
      "cause_label": "classified | destroyed | unlocatable | unknown | null",
      "cause_confidence": 0.0,
      "interpretive_framing": "string",
      "is_interpretive": true
    }}
  ]
}}
"""

def detect_missing_evidence_node(evidence_map: dict) -> dict:
    """
    Detects structural gaps in the evidentiary record.
    Layer 2 — Epistemic Analysis. May hypothesize causes only when external metadata exists.
    """
    user_prompt = NODE_PROMPT + f'\n\nEVIDENCE MAP:\n{json.dumps(evidence_map, indent=2)}\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        evidence_map = input_data.get("map_evidence", {})
        output = detect_missing_evidence_node(evidence_map)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
