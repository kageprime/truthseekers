import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def retrieve_node(query: str) -> dict:
    """
    Retrieves evidence from all truth categories and web sources.
    Uses LLM semantic retrieval generation for dynamic testing on any query.
    """
    prompt = f"""
    Generate realistic documents and web research sources for the query: "{query}".
    
    Structure the response as a JSON object with:
    - documents:
        - confirmed: [ {{ "id": "doc_conf_1", "title": "...", "text": "...", "url": "..." }} ]
        - contested: [ {{ "id": "doc_cont_1", "title": "...", "text": "...", "url": "..." }} ]
        - suppressed: [ {{ "id": "doc_supp_1", "title": "...", "text": "...", "url": "..." }} ]
        - speculative: [ {{ "id": "doc_spec_1", "title": "...", "text": "...", "url": "..." }} ]
        - web: [ {{ "id": "doc_web_1", "title": "...", "text": "...", "url": "..." }} ]
    - metadata:
        - category_counts: {{ "confirmed": 1, ... }}
        
    Ensure the simulated documents are realistic, informative, and directly relevant to the query.
    Return JSON only.
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        query = input_data.get("query", "")
        output = retrieve_node(query)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
