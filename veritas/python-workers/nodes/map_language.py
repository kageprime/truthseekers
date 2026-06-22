import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Precision Language Mapper — Layer 2 (Epistemic Analysis)

FUNCTION: Detect euphemisms and institutional framing language; offer precise alternatives while preserving originals.

SUPPLEMENTAL INSTRUCTIONS:
- Dual output only: original phrase + suggested alternative. Never enforce replacement.
- Identify the institutional origin and function of the framing (e.g., "legal liability shield").
- Mark all flags as interpretive.
- Never state replacements as factual corrections; frame as precision upgrades.

OUTPUT FORMAT:
{{
  "language_flags": [
    {{
      "claim_id": "uuid",
      "source_phrase": "string",
      "neutral_description": "string",
      "precision_upgrade": "string",
      "framing_origin": "string",
      "framing_function": "string",
      "confidence": 0.0,
      "original_text_preserved": true,
      "is_interpretive": true
    }}
  ]
}}
"""

def map_language_node(claims_output: dict) -> dict:
    """
    Detects euphemisms and institutional framing language.
    Layer 2 — Epistemic Analysis. Dual output: original + precision upgrade. All flags marked interpretive.
    """
    claims = claims_output.get("extract_claims", {}).get("claims", [])
    user_prompt = NODE_PROMPT + f'\n\nCLAIMS:\n{json.dumps(claims, indent=2)}\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        output = map_language_node(input_data)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
