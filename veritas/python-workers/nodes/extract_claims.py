import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def extract_claims_node(retrieval_output: dict) -> dict:
    """
    Extracts atomic, verifiable claims from retrieved documents.
    Does NOT interpret, summarize, or synthesize.
    Returns JSON list of atomic claims.
    """
    documents = retrieval_output.get("documents", {})
    
    prompt = f"""
    Extract atomic, verifiable factual claims from the provided documents.
    
    Rules:
    - Each claim must be a single, testable statement.
    - Do NOT combine multiple facts into one claim.
    - Do NOT interpret, summarize, or draw conclusions.
    - For each claim, cite the specific document and passage.
    - If a document makes no factual claims, output nothing for it.
    
    Documents: {documents}
    
    Return JSON: {{ "claims": [ {{ "text": "...", "source_doc_id": "...", "passage": "..." }} ] }}
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        output = extract_claims_node(input_data)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
