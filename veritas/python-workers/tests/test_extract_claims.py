import unittest
import sys
import os

# Ensure import paths are mapped correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nodes.extract_claims import extract_claims_node

class TestExtractClaims(unittest.TestCase):
    def test_extract_claims_mock(self):
        retrieval_output = {
            "documents": {
                "confirmed": [
                    {"id": "doc1", "text": "This is a document about JFK."}
                ]
            }
        }
        res = extract_claims_node(retrieval_output)
        
        # Verify the structure is correct
        self.assertIn("claims", res)
        self.assertIsInstance(res["claims"], list)
        self.assertGreater(len(res["claims"]), 0)
        self.assertEqual(res["claims"][0]["source_doc_id"], "doc_jfk_hearings_1979")

if __name__ == '__main__':
    unittest.main()
