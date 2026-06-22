import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def detect_missing_evidence_node(evidence_map: dict) -> dict:
    """
    Detects structural gaps in the evidentiary record.
    """
    prompt = f"""
    Analyze the evidence map for structural gaps:
    
    For each gap detected:
    - gap_type: expected | unexpected | unknown_expectedness
    - expected_artifact: patent | primary_source | dataset | eyewitness | other
    - verification_status: verified_gap | unverified_gap | false_positive_risk
    - external_metadata: (only if available — secrecy_order_number, foia_denial_id, destruction_log_ref)
    - cause_label: classified | destroyed | unlocatable | unknown (ONLY if external_metadata exists; otherwise "unknown")
    
    Evidence Map: {evidence_map}
    
    Return JSON: {{ "gaps": [ {{ "gap_type": "...", "expected_artifact": "...", "description": "...", "verification_status": "..." }} ] }}
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        evidence_map = input_data.get("map_evidence", {})
        output = detect_missing_evidence_node(evidence_map)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
