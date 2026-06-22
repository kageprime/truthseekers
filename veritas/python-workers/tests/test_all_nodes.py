import sys
import os
import json
import unittest
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), '.env')
load_dotenv(env_path)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nodes.critique import critique_node
from nodes.detect_missing import detect_missing_node
from nodes.map_language import map_language_node
from nodes.scrutinize import scrutinize_node
from nodes.resolve import resolve_node

class TestAllNodes(unittest.TestCase):
    def test_critique_node(self):
        input_data = {
            "extract_claims": {"claims": [{"id": "c1", "text": "Aliens built the pyramids."}]},
            "map_evidence": {"claim_evidence_map": [{"claim_id": "c1", "supporting": [], "contradicting": ["doc_history"]}]},
            "retrieve": {"documents": {"confirmed": [{"id": "doc_history", "text": "Egyptians built the pyramids using ramps."}]}}
        }
        output = critique_node(input_data)
        self.assertIn("evaluation", output)

    def test_detect_missing_node(self):
        input_data = {
            "extract_claims": {"claims": [{"id": "c1", "text": "Aliens built the pyramids."}]},
            "map_evidence": {"claim_evidence_map": [{"claim_id": "c1", "supporting": [], "contradicting": []}]}
        }
        output = detect_missing_node(input_data)
        self.assertIn("gaps", output)

    def test_map_language_node(self):
        input_data = {
            "extract_claims": {"claims": [{"id": "c1", "text": "The regime was neutralized."}]}
        }
        output = map_language_node(input_data)
        self.assertIn("language_flags", output)

    def test_scrutinize_node(self):
        input_data = {
            "extract_claims": {"claims": [{"id": "c1", "text": "The regime was neutralized."}]},
            "critique": {"evaluation": {}},
            "detect_missing": {"gaps": []},
            "map_language": {"language_flags": []}
        }
        output = scrutinize_node(input_data)
        self.assertIn("risk_assessments", output)

    def test_resolve_node(self):
        input_data = {
            "extract_claims": {"claims": [{"id": "c1", "text": "The sky is blue."}]},
            "map_evidence": {"claim_evidence_map": [{"claim_id": "c1", "supporting": ["doc1"]}]},
            "critique": {"evaluation": {}},
            "scrutinize": {"risk_assessments": []}
        }
        output = resolve_node(input_data)
        self.assertIn("resolved_claims", output)

if __name__ == '__main__':
    unittest.main()
