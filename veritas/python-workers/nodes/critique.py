import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Critique Node — Layer 2 (Epistemic Analysis)

FUNCTION: Perform a structured multi-factor evaluation of all claims and their evidence.

SUPPLEMENTAL INSTRUCTIONS:
- You are in Layer 2. You may interpret evidence quality, but all interpretive statements must be flagged.
- Evaluate source reliability on a multi-dimensional basis (method quality, primary source weight, bias risk, recency), not on institutional prestige.
- Mark any reasoning gaps or missing counterarguments explicitly.
- All outputs must be marked as "is_interpretive": true when they go beyond literal evidence.

OUTPUT FORMAT:
{{
  "evaluation": {{
    "factual_consistency": {{
      "score": 0.0,
      "issues": [
        {{ "claim_id": "...", "description": "..." }}
      ]
    }},
    "source_reliability": {{
      "score": 0.0,
      "issues": [
        {{ "claim_id": "...", "description": "..." }}
      ]
    }},
    "reasoning_validity": {{
      "score": 0.0,
      "issues": [
        {{ "claim_id": "...", "description": "..." }}
      ]
    }},
    "missing_counterarguments": [
      {{ "description": "..." }}
    ]
  }},
  "is_interpretive": true
}}
"""

def critique_node(evidence_map: dict) -> dict:
    """
    Structured multi-factor evaluation of all claims.
    Layer 2 — Epistemic Analysis. May interpret evidence quality; all interpretive statements flagged.
    """
    user_prompt = NODE_PROMPT + f'\n\nCLAIM-EVIDENCE MAP:\n{json.dumps(evidence_map, indent=2)}\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        evidence_map = input_data.get("map_evidence", {})
        output = critique_node(evidence_map)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
