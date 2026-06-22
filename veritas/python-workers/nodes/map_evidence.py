import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Evidence Mapping Node — Layer 1 (Evidence Integrity)

FUNCTION: Map each extracted claim to supporting and contradicting evidence, and identify evidence gaps.

SUPPLEMENTAL INSTRUCTIONS:
- For each claim, link to specific evidence items found or not found.
- If a type of evidence is expected but missing, flag it as a gap with the appropriate metadata.
- Never assign a cause_label for a gap. Leave external metadata as-is.
- Gaps are reported as presence/absence with metadata only.

OUTPUT FORMAT:
{{
  "claim_evidence_map": [
    {{
      "claim_id": "uuid",
      "supporting": ["evidence_id_1", ...],
      "contradicting": ["evidence_id_2", ...],
      "missing_expected": [
        {{
          "gap_type": "expected | unexpected | unknown_expectedness",
          "expected_artifact": "patent | primary_source | dataset | eyewitness",
          "verification_status": "verified_gap | unverified_gap | false_positive_risk",
          "external_metadata": "string | null"
        }}
      ]
    }}
  ]
}}
"""

def map_evidence_node(claims_output: dict, retrieval_output: dict) -> dict:
    """
    Maps each claim to supporting and contradicting evidence,
    and identifies evidence gaps.
    Layer 1 — Evidence Integrity. No cause assignment, no interpretation.
    """
    claims = claims_output.get("claims", [])
    documents = retrieval_output.get("documents", {})
    user_prompt = NODE_PROMPT + f'\n\nCLAIMS:\n{json.dumps(claims, indent=2)}\n\nAVAILABLE EVIDENCE:\n{json.dumps(documents, indent=2)}\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        claims_output = input_data.get("extract_claims", {})
        retrieval_output = input_data.get("retrieve", {})
        output = map_evidence_node(claims_output, retrieval_output)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
