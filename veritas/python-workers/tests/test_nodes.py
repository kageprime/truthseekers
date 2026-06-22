import sys
import os
import json
import unittest
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), '.env')
load_dotenv(env_path)

# Ensure imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nodes.extract_claims import extract_claims_node
from nodes.map_evidence import map_evidence_node

class TestLLMPrompts(unittest.TestCase):

    def setUp(self):
        # We need the real LLM here, so we won't mock it unless OPENAI_API_KEY is mock-key.
        # But if the user added GROQ_API_KEY, it should hit the real API.
        pass

    def test_extract_claims(self):
        input_data = {
            "documents": {
                "confirmed": [
                    {
                        "id": "doc_moon_1",
                        "text": "The Apollo 11 mission landed on the Moon on July 20, 1969. Commander Neil Armstrong and lunar module pilot Buzz Aldrin were the first humans to walk on the lunar surface.",
                        "url": "https://nasa.gov/apollo11"
                    }
                ]
            }
        }
        
        print("\nTesting extract_claims_node...")
        output = extract_claims_node(input_data)
        
        self.assertIn("claims", output, "Output must contain 'claims' key")
        self.assertTrue(isinstance(output["claims"], list), "'claims' must be a list")
        
        if len(output["claims"]) > 0:
            first_claim = output["claims"][0]
            self.assertIn("text", first_claim)
            self.assertIn("source_doc_id", first_claim)
            self.assertIn("passage", first_claim)
            print(f"Extracted {len(output['claims'])} claims successfully.")
        else:
            print("No claims extracted, but format was valid.")

    def test_map_evidence(self):
        input_data = {
            "claims": [
                {
                    "id": "claim_1",
                    "text": "Neil Armstrong was the first human on the Moon."
                }
            ],
            "documents": {
                "confirmed": [
                    {
                        "id": "doc_moon_1",
                        "text": "Commander Neil Armstrong and lunar module pilot Buzz Aldrin were the first humans to walk on the lunar surface."
                    }
                ]
            }
        }
        
        print("\nTesting map_evidence_node...")
        output = map_evidence_node(input_data, input_data)
        
        self.assertIn("claim_evidence_map", output)
        self.assertTrue(isinstance(output["claim_evidence_map"], list))
        
        if len(output["claim_evidence_map"]) > 0:
            first_map = output["claim_evidence_map"][0]
            self.assertIn("claim_id", first_map)
            self.assertIn("supporting", first_map)
            self.assertIn("contradicting", first_map)
            print(f"Mapped {len(output['claim_evidence_map'])} claims successfully.")

if __name__ == '__main__':
    unittest.main()
