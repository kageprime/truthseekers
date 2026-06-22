import os
import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

_dotenv = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
if os.path.isfile(_dotenv):
    try:
        from dotenv import load_dotenv
        load_dotenv(_dotenv)
    except ImportError:
        pass

PROVIDERS = [
    {
        "name": "groq",
        "api_key": os.getenv("GROQ_API_KEY"),
        "base_url": os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1"),
        "model": os.getenv("LLM_MODEL", "qwen/qwen3-32b"),
    },
    {
        "name": "do-inference",
        "api_key": os.getenv("MODEL_ACCESS_KEY"),
        "base_url": os.getenv("DO_BASE_URL", "https://inference.do-ai.run/v1"),
        "model": os.getenv("DO_MODEL", "gemma-4-31B-it"),
    },
    {
        "name": "nvidia-nim",
        "api_key": os.getenv("NVIDIA_API_KEY"),
        "base_url": os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
        "model": os.getenv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct"),
    },
    {
        "name": "openai",
        "api_key": os.getenv("OPENAI_API_KEY"),
        "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    },
]

MOCK_RESPONSE = {"claims": []}


def _call(provider: dict, system_prompt: str, user_prompt: str) -> dict | None:
    client = OpenAI(api_key=provider["api_key"], base_url=provider["base_url"])
    kwargs = {
        "model": provider["model"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0,
    }
    if provider["name"] == "groq" and ("qwen" in provider["model"].lower() or "gpt-oss" in provider["model"].lower()):
        kwargs["extra_body"] = {"reasoning_format": "parsed"}

    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    if not content:
        return None
    return json.loads(content)


class LLMClient:
    def invoke(self, system_prompt: str, user_prompt: str) -> dict:
        active = [p for p in PROVIDERS if p["api_key"]]
        if not active:
            logger.warning("no API keys configured, returning mock response")
            return MOCK_RESPONSE

        errors = []
        for provider in active:
            try:
                result = _call(provider, system_prompt, user_prompt)
                if result is not None:
                    return result
                errors.append(f"{provider['name']}: empty response")
            except Exception as e:
                logger.warning("%s failed: %s", provider["name"], e)
                errors.append(f"{provider['name']}: {e}")

        logger.error("all providers failed: %s", "; ".join(errors))
        # ponytail: last-provider fallback to mock, add hitl queue if this becomes noisy
        return MOCK_RESPONSE


llm = LLMClient()
