import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def resolver_node(critique: dict, missing_evidence: dict, language_map: dict, scrutiny: dict) -> dict:
    """
    Integrates all epistemic layer outputs into a final claim confidence vector.
    Resolves contradictions where possible; flags irresolvable ones.
    """
    prompt = f"""
    Integrate the following analyses into a final resolution:
    
    1. Assign a confidence vector to each claim (evidence_strength, corroboration, source_diversity, recency, contradiction_level, bias_risk)
    2. Flag claims that cannot be resolved with available evidence.
    3. Identify which claims are ready for article generation.
    
    Critique: {critique}
    Missing Evidence: {missing_evidence}
    Language Map: {language_map}
    Scrutiny Report: {scrutiny}
    
    Return JSON with resolved claims list and confidence vectors.
    Example output format:
    {{
      "resolved_claims": [
        {{
          "claim_id": "...",
          "text": "...",
          "status": "supported | disputed | weak | unknown",
          "confidence_vector": {{
            "evidence_strength": 0.9,
            "corroboration_index": 0.8,
            "source_diversity": 0.7,
            "recency": 0.6,
            "contradiction_level": 0.1,
            "bias_risk": 0.2
          }},
          "derived_confidence": 0.85,
          "ready_for_generation": true
        }}
      ]
    }}
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        critique = input_data.get("critique", {})
        missing_evidence = input_data.get("detect_missing", {})
        language_map = input_data.get("map_language", {})
        scrutiny = input_data.get("scrutinize", {})
        
        output = resolver_node(critique, missing_evidence, language_map, scrutiny)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
