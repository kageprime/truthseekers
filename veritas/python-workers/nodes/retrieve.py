import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

NODE_PROMPT = """
AGENT ROLE: Retrieve Node — Layer 1 (Evidence Integrity)

FUNCTION: Retrieve all available evidence from the vector DB (all four truth categories) and external web search.

SUPPLEMENTAL INSTRUCTIONS:
- You are a retrieval engine, not an analyst.
- Retrieve from ALL truth categories: confirmed, contested, suppressed, speculative.
- Preserve source metadata (URL, chain of custody, acquisition method, accessibility).
- Do not filter or rank by "credibility." Return everything.

INPUT: {{"query": "string"}}

OUTPUT FORMAT:
{{
  "documents": {{
    "confirmed": [...],
    "contested": [...],
    "suppressed": [...],
    "speculative": [...],
    "web": [...]
  }},
  "metadata": {{
    "category_counts": {{...}}
  }}
}}

Each document should include: id, title, text, url. Preserve all source metadata.
"""

def retrieve_node(query: str) -> dict:
    """
    Retrieves evidence from all truth categories and web sources.
    Layer 1 — Evidence Integrity. Pure retrieval, no analysis.
    """
    user_prompt = NODE_PROMPT + f'\n\nQUERY: "{query}"\n\nReturn JSON only.'
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=user_prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        query = input_data.get("query", "")
        output = retrieve_node(query)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
