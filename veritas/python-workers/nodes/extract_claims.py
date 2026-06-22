import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Claim Extraction Node — Layer 1 (Evidence Integrity)

FUNCTION: Extract atomic, verifiable factual claims from the retrieved documents.

SUPPLEMENTAL INSTRUCTIONS:
- Each claim must be a single, testable statement.
- Do NOT combine multiple facts into one claim.
- Do NOT interpret, summarize, or synthesize.
- Every claim must reference the exact source document and passage.
- If a document contains no factual claims, ignore it.

OUTPUT FORMAT:
{{
  "claims": [
    {{
      "claim_id": "uuid",
      "text": "string",
      "source_doc_id": "string",
      "passage": "string"
    }}
  ]
}}

Generate unique UUIDs for each claim_id.
"""

def extract_claims_node(retrieval_output: dict) -> dict:
    """
    Extracts atomic, verifiable claims from retrieved documents.
    Layer 1 — Evidence Integrity. No interpretation, no synthesis.
    """
    documents = retrieval_output.get("retrieve", retrieval_output).get("documents", {})
    user_prompt = NODE_PROMPT + f'\n\nDOCUMENTS:\n{json.dumps(documents, indent=2)}\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        output = extract_claims_node(input_data)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
