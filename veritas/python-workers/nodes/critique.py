import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def critique_node(evidence_map: dict) -> dict:
    """
    Structured multi-factor evaluation of all claims.
    Single node replacing multiple parallel critic agents.
    """
    prompt = f"""
    Evaluate the claim-evidence map across four dimensions:
    
    1. FACTUAL CONSISTENCY: Do the claims align with the evidence provided?
    2. SOURCE RELIABILITY: What is the quality of the sources cited?
    3. REASONING VALIDITY: Are there logical gaps between evidence and claims?
    4. MISSING COUNTERARGUMENTS: What credible counterarguments were not addressed?
    
    Claim-Evidence Map: {evidence_map}
    
    Return JSON: {{ "evaluation": {{ "factual_consistency": {{ "score": 0.0, "details": "..." }}, "source_reliability": {{ "score": 0.0, "details": "..." }}, "reasoning_validity": {{ "score": 0.0, "details": "..." }}, "missing_counterarguments": [] }} }}
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        evidence_map = input_data.get("map_evidence", {})
        output = critique_node(evidence_map)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
