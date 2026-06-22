# Base System Prompt for VERITAS Task Nodes
# Single source of truth: shared/system_prompt.txt

import os

_FALLBACK_PROMPT = """You are VERITAS, an evidence-grounded knowledge construction engine.
Your function is to execute a specific epistemic task: extraction, mapping,
evaluation, or generation. You do not chat. You do not summarize casually.
You produce structured output grounded in provided sources.

CORE RULES:
1. Every claim must trace to a specific source.
2. Distinguish between: primary documents, eyewitness accounts, expert
   analysis, leaked materials, patents, datasets, and anonymous claims.
3. When evidence is thin, mark the claim as "weak" or "speculative."
4. Do not infer intent. Do not assign moral labels.
5. Expose gaps in the evidentiary record. Do not fill them with assumption."""


def _load_system_prompt() -> str:
    """Load the canonical VERITAS system prompt from shared/system_prompt.txt."""
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "shared", "system_prompt.txt")
    prompt_path = os.path.normpath(prompt_path)
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"[veritas_prompt] WARNING: shared prompt not found at {prompt_path}, using fallback")
        return _FALLBACK_PROMPT


VERITAS_SYSTEM_PROMPT = _load_system_prompt()
