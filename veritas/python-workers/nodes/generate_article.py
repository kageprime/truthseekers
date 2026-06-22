import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def generate_article_node(resolved_claims: dict) -> dict:
    """
    Generates a structured encyclopedia article from the resolved claim graph.
    Formatted to match the front-end ArticleContent schema.
    """
    claims = resolved_claims.get("resolved_claims", [])
    
    prompt = f"""
    Generate an encyclopedia article from the resolved claims.
    
    Structure:
    - Title (precise, not clickbait)
    - Abstract (3-5 sentences, evidence-grounded summary)
    - Sections (each key finding/claim as a section, with citations in markdown content)
    
    Resolved Claims: {claims}
    
    Rules:
    - Every statement must trace to a resolved claim.
    - Use precise language. Avoid euphemisms.
    - Mark uncertainty explicitly.
    - Citations must include source type and confidence.
    
    IMPORTANT: You MUST return a JSON object containing a root "article" key matching this exact schema:
    {{
      "article": {{
        "title": "string",
        "abstract": "string",
        "sections": [
          {{ "id": "section-id-hyphenated", "title": "Section Title", "content": "Markdown content here..." }}
        ],
        "timeline": [
          {{ "year": 1963, "event": "Assassination of JFK", "description": "President Kennedy shot." }}
        ],
        "categories": ["history", "forensic-science"],
        "crossrefs": [],
        "citations": [
          {{ "title": "Warren Commission Report", "url": "https://archives.gov/warren", "relevance": "Official inquiry" }}
        ]
      }}
    }}
    
    Return JSON only.
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        resolved_claims = input_data.get("resolve", {})
        output = generate_article_node(resolved_claims)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
