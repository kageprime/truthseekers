import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def map_evidence_node(claims_output: dict, retrieval_output: dict) -> dict:
    """
    Maps each claim to supporting and contradicting evidence,
    and identifies evidence gaps.
    """
    claims = claims_output.get("claims", [])
    documents = retrieval_output.get("documents", {})

    prompt = f"""
    For each claim, map:
    1. Supporting evidence (specific document IDs that support the claim)
    2. Contradicting evidence (specific document IDs that contradict the claim)
    3. Missing expected evidence (what specific evidence/documents should exist but weren't found)
    
    Claims: {claims}
    Available Evidence: {documents}
    
    Return JSON: {{ "claim_evidence_map": [ {{ "claim_id": "...", "supporting": ["doc_id_1"], "contradicting": [], "missing_expected": [] }} ] }}
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

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
