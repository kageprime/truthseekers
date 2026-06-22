import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.client import llm
from veritas_prompt import VERITAS_SYSTEM_PROMPT

def map_language_node(claims_output: dict) -> dict:
    """
    Detects euphemisms and institutional framing language.
    """
    claims = claims_output.get("extract_claims", {}).get("claims", [])
    
    prompt = f"""
    Scan the claims for euphemisms and institutional framing language.
    
    For each detection:
    1. source_phrase: the original phrase used
    2. neutral_description: a plain-language description of what it refers to
    3. precision_upgrade: a more precise term (optional)
    4. framing_origin: the institutional context that produced this framing
    5. framing_function: what the framing achieves (e.g., liability shield, emotional distance)
    6. confidence: how confident the detection is (0-1)
    
    Claims: {claims}
    
    Return JSON: {{ "language_flags": [ {{ "source_phrase": "...", "neutral_description": "...", "precision_upgrade": "...", "confidence": 0.9 }} ] }}
    """
    return llm.invoke(system_prompt=VERITAS_SYSTEM_PROMPT, user_prompt=prompt)

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        output = map_language_node(input_data)
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
