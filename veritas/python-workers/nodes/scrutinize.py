import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def scrutinize_accusation_node(evidence_map: dict) -> dict:
    """
    Detects high-risk epistemic structures in claims.
    """
    prompt = f"""
    Scan the evidence map for structural risk factors:
    
    Risk Factors:
    - collective_attribution: claim attributes behavior to an entire group
    - single_source_dependency: claim relies on a single source
    - coercion_indicators: source was produced under duress, torture, or threat
    - historical_propaganda_template_match: claim structure matches known propaganda templates
    
    For each claim with risk factors:
    - List the risk factors present
    - Assign a risk_score (0-1)
    - Recommend: requires_extra_corroboration, excluded_evidence_ids, minimum_independent_sources
    
    Evidence Map: {evidence_map}
    
    Return JSON: {{ "risk_assessments": [ {{ "claim_id": "...", "risk_factors": [...], "risk_score": 0.5 }} ] }}
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        evidence_map = input_data.get("map_evidence", {})
        output = scrutinize_accusation_node(evidence_map)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
