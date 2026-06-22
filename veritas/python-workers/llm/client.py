import os
import json
from openai import OpenAI

class LLMClient:
    def __init__(self):
        # Support Groq API
        api_key = os.getenv("GROQ_API_KEY", os.getenv("OPENAI_API_KEY", "mock-key"))
        base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
        
        self.is_mock = api_key == "mock-key"
        self.model = os.getenv("LLM_MODEL", "llama-3.1-8b-instant") # Default Groq model

        if not self.is_mock:
            self.client = OpenAI(api_key=api_key, base_url=base_url)

    def invoke(self, system_prompt: str, user_prompt: str) -> dict:
        if self.is_mock:
            # Safe mock return when no API key is present
            return {
                "claims": [
                    {
                        "text": "Lee Harvey Oswald did not fire the fatal shot that killed John F. Kennedy.",
                        "source_doc_id": "doc_jfk_hearings_1979",
                        "passage": "Based on acoustic analysis, the committee concluded there was a high probability of two gunmen firing at the President."
                    }
                ]
            }
        
        kwargs = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"}
        }

        # Enable reasoning format for Qwen and GPT-OSS reasoning models
        if "qwen" in self.model or "gpt-oss" in self.model:
            kwargs["extra_body"] = {"reasoning_format": "parsed"}

        response = self.client.chat.completions.create(**kwargs)
        
        # When reasoning is returned parsed, we can safely just take content
        content = response.choices[0].message.content
        
        try:
            return json.loads(content)
        except Exception:
            return {"raw_output": content, "error": "Invalid JSON response from LLM"}

llm = LLMClient()
