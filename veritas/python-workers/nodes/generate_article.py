import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Article Generator Node — Layer 3 (Knowledge Construction)

FUNCTION: Generate the final encyclopedia article as a structured view over the resolved claim graph.

SUPPLEMENTAL INSTRUCTIONS:
- Build the article from the resolved claims; do not introduce new claims.
- Use precise language. If Layer 2 offered precision upgrades, you may adopt them, but must show the original phrasing in language notes.
- Include sections for Evidence Gaps, Dissenting Perspectives, and Confidence Note.
- Every factual statement must be traceable to a specific claim_id.
- Mark uncertainty clearly. The reader must see what is solid and what is interpretive.
- Never invent evidence, drop provenance, or re-label an interpretive claim as factual.

OUTPUT FORMAT (return a JSON object with root "article" key):
{{
  "article": {{
    "title": "string",
    "abstract": "string",
    "sections": [
      {{
        "id": "section-id-hyphenated",
        "title": "Section Title",
        "content": "Markdown content with citations..."
      }}
    ],
    "evidence_gaps": [
      {{
        "description": "string",
        "gap_type": "string",
        "verification_status": "string"
      }}
    ],
    "dissenting_perspectives": [
      {{
        "claim_id": "string",
        "perspective": "string"
      }}
    ],
    "confidence_note": "string",
    "timeline": [
      {{ "year": 1963, "event": "...", "description": "..." }}
    ],
    "categories": ["history", "forensic-science"],
    "crossrefs": [],
    "citations": [
      {{ "title": "...", "url": "...", "relevance": "..." }}
    ]
  }}
}}

Return JSON only. The title MUST be a specific, concrete article title about the actual topic — never a generic label like "Analysis of Resolved Claims" or "Article Generation Result".
"""

def generate_article_node(resolved_claims: dict) -> dict:
    claims = resolved_claims.get("resolved_claims", [])
    if not claims:
        return {
            "article": {
                "title": resolved_claims.get("topic", "Insufficient Data"),
                "abstract": "The epistemic pipeline did not produce resolved claims for this topic. Available information was insufficient for structured article generation.",
                "sections": [],
                "evidence_gaps": [],
                "dissenting_perspectives": [],
                "confidence_note": "No claims were extracted or resolved.",
                "timeline": [],
                "categories": [],
                "crossrefs": [],
                "citations": [],
            }
        }
    user_prompt = NODE_PROMPT + f'\n\nRESOLVED CLAIMS:\n{json.dumps(claims, indent=2)}\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        resolved_claims = input_data.get("resolve", {})
        output = generate_article_node(resolved_claims)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
