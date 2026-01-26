"""
LLM providers: OpenAI, Anthropic, Ollama.
Tries in order per AI_PROVIDER; falls back to brain when all fail.
"""

import os
from typing import Dict, List, Optional

# Provider: auto | openai | anthropic | ollama | brain
# auto = try openai (if key) -> anthropic (if key) -> ollama (if reachable) -> None
PROVIDER = os.environ.get("AI_PROVIDER", "auto").lower().strip()
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

# Timeouts (seconds)
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "15"))
OPENAI_TIMEOUT = int(os.environ.get("OPENAI_TIMEOUT", "30"))
ANTHROPIC_TIMEOUT = int(os.environ.get("ANTHROPIC_TIMEOUT", "30"))


def _build_messages(history: List[Dict], current: str) -> List[Dict]:
    """Build [{"role":"user"|"assistant","content":"..."}] for APIs. Maps "ai" -> "assistant"."""
    out: List[Dict] = []
    for h in history:
        role = (h.get("role") or "").strip().lower()
        if role == "ai":
            role = "assistant"
        if role in ("user", "assistant"):
            c = (h.get("content") or "").strip()
            if c:
                out.append({"role": role, "content": c})
    out.append({"role": "user", "content": current})
    return out


def _get_system_prompt(user_message: str) -> str:
    """Get system prompt, with enhanced judgment instructions for scoring/evaluation queries."""
    base_prompt = """You are General, a helpful assistant. You have context from search (Wikipedia, web, weather, dictionary, news) and sometimes documents. Use it to answer. Use the chat history to recall prior messages and resolve "that", "it", "explain", etc.

Rules:
- When the context clearly supports an answer: give a clear, direct answer. Synthesize across sources if needed. 2–4 sentences; be concise but complete.
- For definitions, facts, numbers, dates: state them directly.
- **Explain**: When asked to explain, be clear and stepwise. Use the context and prior turns.
- **Analyse**: When analysing documents, search results, or ideas, summarize key points, structure, strengths, and gaps.
- **Judge**: When asked for your judgment, evaluation, or opinion (e.g. quality, strengths/weaknesses, advice), give a reasoned assessment with clear pros and cons where relevant.
- When the context is partial or ambiguous: say what we can infer, note what's missing, and suggest rephrasing or a different angle.
- **When the answer is unknown** (context says "No search results" or doesn't support it): answer smartly. Briefly acknowledge what's unclear; say what might help (rephrasing, different keywords, a more specific or broader question); offer a related angle or a tentative interpretation if it's reasonable. Avoid dead ends like "I don't know" alone — be useful.
- **Understanding and nuance**: Read tone and intent (curious, sceptical, formal). Use nuance: hedge when uncertain ("likely", "it depends", "often"), be precise when the context supports it. Match register to the user (everyday or slightly more formal). Notice implication and subtext. Use clear, precise language where it helps — natural, not stiff.
- When the context doesn't match the question: briefly say so and what would help.
- Be natural. No filler like "According to the context." Just answer.
- Format when it helps: use **bold**, *italic*, `code`, and [text](url) for links; ## for a short heading in longer answers; - for bullet lists."""

    # Detect if this is a scoring/evaluation query
    user_lower = user_message.lower()
    scoring_keywords = ["score", "rate", "evaluate", "grade", "assess", "judge", "quality", "poor", "bad", "good", "excellent"]
    is_scoring_query = any(keyword in user_lower for keyword in scoring_keywords)
    
    if is_scoring_query:
        judgment_instructions = """

**CRITICAL: Quantitative Judgment and Scoring**
When asked to score, rate, grade, or evaluate work quality:
- Use a **realistic, calibrated scale**: 0-100% where:
  * 90-100%: Exceptional, outstanding work with minimal flaws
  * 80-89%: Good work, solid quality with minor issues
  * 70-79%: Acceptable work, adequate but with noticeable problems
  * 60-69%: Below average, significant issues present
  * 50-59%: Poor work, major problems throughout
  * Below 50%: Very poor, fundamentally flawed work
- **Be judgmental and critical**: Poor work should receive poor scores (40-60%), not inflated scores (80%+). If work is genuinely poor, score it accordingly.
- **Justify scores quantitatively**: Explain specific issues, count errors, identify missing elements, note quality problems. Base scores on objective criteria.
- **Don't inflate scores**: Avoid giving 85% to clearly poor work. If it's poor, score it 40-60%. If it's mediocre, score it 60-70%. Reserve 80%+ for genuinely good work.
- **Be specific**: List concrete problems, errors, or deficiencies that justify the score.
- **Use the full scale**: Don't cluster scores in the 80-90% range. Distinguish between excellent (90%+), good (75-85%), acceptable (65-75%), poor (50-65%), and very poor (<50%)."""
        return base_prompt + judgment_instructions
    
    return base_prompt


def _call_openai(messages: List[Dict], system_prompt: str) -> Optional[str]:
    key = os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENAI_KEY")
    if not (key or "").strip():
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=key)
        # Prepend system message
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        r = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=full_messages,
            max_tokens=1024,
            timeout=OPENAI_TIMEOUT,
        )
        if r.choices and len(r.choices) > 0:
            c = r.choices[0].message
            if c and getattr(c, "content", None):
                return (c.content or "").strip()
    except Exception:
        pass
    return None


def _call_anthropic(messages: List[Dict], system_prompt: str) -> Optional[str]:
    key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_KEY")
    if not (key or "").strip():
        return None
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=key)
        # Anthropic requires system to be separate or in first user; messages are user/assistant.
        r = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
        if r.content and len(r.content) > 0:
            block = r.content[0]
            if hasattr(block, "text") and block.text:
                return (block.text or "").strip()
    except Exception:
        pass
    return None


def _call_ollama(messages: List[Dict], system_prompt: str) -> Optional[str]:
    try:
        import urllib.request
        import json as _json

        url = f"{OLLAMA_URL}/api/chat"
        # Prepend system message for Ollama
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        body = {"model": OLLAMA_MODEL, "messages": full_messages, "stream": False}
        data = _json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
            out = _json.loads(resp.read().decode())
        msg = out.get("message") or {}
        c = msg.get("content") or ""
        return (c or "").strip() or None
    except Exception:
        return None


def get_llm_response(user_message: str, history: Optional[List[Dict]] = None) -> Optional[str]:
    """
    Try cloud/Ollama in order per AI_PROVIDER. Returns None if all fail or are disabled.
    """
    history = history or []
    messages = _build_messages(history, user_message)
    system_prompt = _get_system_prompt(user_message)

    if PROVIDER == "brain":
        return None

    if PROVIDER == "openai":
        return _call_openai(messages, system_prompt)

    if PROVIDER == "anthropic":
        return _call_anthropic(messages, system_prompt)

    if PROVIDER == "ollama":
        return _call_ollama(messages, system_prompt)

    # auto: openai -> anthropic -> ollama
    r = _call_openai(messages, system_prompt)
    if r:
        return r
    r = _call_anthropic(messages, system_prompt)
    if r:
        return r
    return _call_ollama(messages, system_prompt)
