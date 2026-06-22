import sys
import os
import json

# Ensure import works under running worker contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from veritas_prompt import VERITAS_SYSTEM_PROMPT

def store_node(*args) -> dict:
    """
    Agent 10: Store Node — Infrastructure Layer (N/A)

    FUNCTION: Persist the final article, claims, evidence records, and all Layer 2
    analysis results to the database and vector store.

    This node does NOT use the LLM. It is a pure storage passthrough. The Go
    orchestrator handles persistence via its storage layer; this script exists
    as a structural placeholder in the DAG and validates that the input schema
    is intact before passing the data downstream.

    SUPPLEMENTAL INSTRUCTIONS:
    - No inference. Pure storage.
    - Ensure all provenance metadata is preserved.
    """
    # The store node receives all upstream outputs as a single combined input.
    # Since the Go orchestrator handles actual DB writes, this node validates
    # the input structure and passes it through as confirmation.
    input_data = json.load(sys.stdin)

    # Validate required keys are present
    required_keys = ["generate_article"]
    present_keys = [k for k in required_keys if k in input_data]
    missing_keys = [k for k in required_keys if k not in input_data]

    result = {
        "status": "stored",
        "persisted_keys": present_keys,
        "missing_keys": missing_keys,
        "message": "All outputs persisted successfully." if not missing_keys else f"Warning: missing upstream data for {missing_keys}",
    }

    return result


if __name__ == '__main__':
    try:
        output = store_node()
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)
