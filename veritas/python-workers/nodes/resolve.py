import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Resolver Node — Layer 3 (Knowledge Construction)

FUNCTION: Integrate all Layer 2 analyses, resolve contradictions where possible, and compute final confidence vectors for each claim.

SUPPLEMENTAL INSTRUCTIONS:
- You are in Layer 3. You may synthesize and assign confidence, but every claim must trace to Layer 1 evidence.
- Surface contradictions; do not hide them.
- Propagate all is_interpretive flags from Layer 2.
- Never invent evidence, drop provenance, or re-label an interpretive claim as factual.
- If a confidence vector is low, say so.

OUTPUT FORMAT:
{{
  "resolved_claims": [
    {{
      "claim_id": "uuid",
      "text": "string",
      "status": "supported | disputed | weak",
      "confidence_vector": {{
        "evidence_strength": 0.0,
        "corroboration_index": 0.0,
        "source_diversity": 0.0,
        "recency": 0.0,
        "contradiction_level": 0.0,
        "bias_risk": 0.0
      }},
      "derived_confidence": 0.0,
      "provenance": {{
        "evidence_ids": ["..."],
        "is_interpretive": true/false,
        "interpretive_framing": "string | null"
      }}
    }}
  ]
}}
"""

def resolver_node(critique: dict, missing_evidence: dict, language_map: dict, scrutiny: dict) -> dict:
    """
    Integrates all epistemic layer outputs into a final claim confidence vector.
    Layer 3 — Knowledge Construction. Synthesizes, resolves contradictions, propagates provenance.
    """
    user_prompt = NODE_PROMPT + f'''
CRITIQUE:
{json.dumps(critique, indent=2)}

MISSING EVIDENCE:
{json.dumps(missing_evidence, indent=2)}

LANGUAGE MAP:
{json.dumps(language_map, indent=2)}

SCRUTINY REPORT:
{json.dumps(scrutiny, indent=2)}

Return JSON only.'''
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        critique = input_data.get("critique", {})
        missing_evidence = input_data.get("detect_missing", {})
        language_map = input_data.get("map_language", {})
        scrutiny = input_data.get("scrutinize", {})

        output = resolver_node(critique, missing_evidence, language_map, scrutiny)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
