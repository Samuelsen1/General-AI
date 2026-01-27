"""
AI Brain: pattern matching, intent detection, and simple learning.
Runs locally by default; optional: OpenAI, Anthropic, Ollama, and
embedding-based learned search (sentence-transformers).

Handles: teach/learn, follow-ups, time/date/math, General-AI (Wikipedia/weather/dict/web/news),
LLM fallback, embedding or Dice for learned Q&A, pattern matching, clarification.
"""

import os
import re
import json
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

LEARNED_KV_KEY = "general_ai_learned"

# --- Contraction expansion for better matching ---
_CONTRACTIONS = {
    "what's": "what is", "that's": "that is", "it's": "it is", "who's": "who is",
    "there's": "there is", "here's": "here is", "he's": "he is", "she's": "she is",
    "don't": "do not", "doesn't": "does not", "didn't": "did not", "won't": "will not",
    "can't": "cannot", "couldn't": "could not", "wouldn't": "would not", "shouldn't": "should not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
    "i'll": "i will", "you'll": "you will", "we'll": "we will", "they'll": "they will",
    "i'd": "i would", "you'd": "you would", "we'd": "we would", "they'd": "they would",
    "what're": "what are", "where's": "where is", "how's": "how is", "why's": "why is",
}

# Knowledge base: patterns -> possible responses
KNOWLEDGE = [
    # Greetings
    {"patterns": ["hi", "hello", "hey", "hola", "howdy", "greetings"], "responses": [
        "Hello! How can I help you today?",
        "Hi there! What's on your mind?",
        "Hey! Good to meet you."
    ]},
    # Farewells
    {"patterns": ["bye", "goodbye", "see you", "later", "take care"], "responses": [
        "Goodbye! Take care.",
        "See you later!",
        "Bye! It was nice talking."
    ]},
    # Thanks
    {"patterns": ["thanks", "thank you", "thx"], "responses": [
        "You're welcome!",
        "Happy to help!",
        "Anytime!"
    ]},
    # Name / identity
    {"patterns": ["who are you", "what are you", "your name", "identify yourself"], "responses": [
        "I'm a small AI assistant running on your machine. I learn from patterns and from you.",
        "I'm an AI you can talk to. I try to understand and respond — and I can learn new things if you teach me."
    ]},
    # How it works
    {"patterns": ["how do you work", "how does this work", "how are you built"], "responses": [
        "I use pattern matching and simple similarity to pick responses. You can also teach me new question–answer pairs by saying 'teach: your question -> your answer'."
    ]},
    # Teach
    {"patterns": ["teach:", "learn:"], "responses": []},
    # Feelings
    {"patterns": ["how are you", "how do you feel"], "responses": [
        "I'm doing well, thanks for asking. How about you?",
        "I can't feel like humans, but I'm here and ready to help!"
    ]},
    {"patterns": ["sad", "unhappy", "feeling down"], "responses": [
        "I'm sorry you're feeling that way. Sometimes it helps to talk. What's going on?",
        "That sounds tough. I'm here to listen if you want to share."
    ]},
    {"patterns": ["happy", "excited", "great day"], "responses": [
        "That's wonderful to hear!",
        "I'm glad things are going well!"
    ]},
    # Help
    {"patterns": ["help", "what can you do"], "responses": [
        "I can chat, answer questions, and learn. Try: greetings, 'who are you', or teach: question -> answer. I also use Wikipedia, weather, definitions (and web/news if you set keys); time, date; math (+, -, *, /, **, %, decimals, parentheses, e.g. (2+3)*4, 2^10); visit links (e.g. 'visit https://example.com' or just paste a URL); create tables (e.g. 'create table: Name, Age | Alice, 25 | Bob, 30'); and follow-ups like 'and you?'. Ask 'how does AI understand language' or 'what are tokens' for how language models process text."
    ]},
    # Teach / math
    {"patterns": ["can you teach", "teach math", "teach him math", "teach her math", "teach him all math", "all math", "how do i teach", "how to teach you"], "responses": [
        "I can do math: +, -, *, /, ** (power), %, parentheses, decimals. Try: what is (2+3)*4, 2^10, 10%3, 3.5*2. You can also teach me facts with: teach: question -> answer. On Vercel, set KV/Upstash so I can save."
    ]},
    # How AI / language models understand and process language (tokens, embeddings, attention, decoding)
    {"patterns": [
        "how does ai understand language", "how do language models understand", "how does ai process language",
        "what are tokens", "tokenization", "text to tokens", "how does tokenization work",
        "embeddings", "word vectors", "vectors in ai", "how do embeddings work",
        "self-attention", "transformer", "how do transformers work", "attention in ai",
        "how does ai generate text", "how do language models predict", "decoding", "next token prediction",
        "how does ai produce responses", "how do llms work", "how do language models work",
        "ai meaning", "does ai understand", "emergent understanding"
    ], "responses": [
        "1) **Text to tokens**: Your text is split into tokens (words, sub-words, or characters). Example: \"Understanding language is hard\" → [\"Understand\", \"ing\", \" language\", \" is\", \" hard\"]. Each token gets a number ID—networks need numbers, not letters.\n\n"
        "2) **Encoding**: Each ID becomes a vector (a list of numbers)—a coordinate in \"meaning-space.\" Similar-meaning tokens sit closer (\"king\" and \"queen\"); this is embeddings. There is still no meaning here—just structure from huge text data.\n\n"
        "3) **Context (self-attention)**: Transformers look at all tokens at once and compute how much each should \"pay attention\" to the others. In \"The trophy doesn't fit in the suitcase because it is too small,\" the model learns statistically that \"it\" → \"suitcase,\" from patterns in data, not from knowing objects.\n\n"
        "4) **Decoding**: The core task is: predict the most likely next token. Given \"AI processes language by…\" it assigns probabilities (e.g. \"recognizing\" 42%, \"predicting\" 31%) and picks one. No intention, beliefs, or awareness—only probability distributions.\n\n"
        "5) **\"Understanding\"**: Humans ground language in experience and perception; AI grounds it in statistical structure—what usually goes with what. When AI seems to understand, it's recognizing usage patterns. That's often called functional or emergent understanding, not conscious understanding.\n\n"
        "6) **Producing a reply**: The model repeatedly predicts the next token, appends it, and stops when done. Grammar, tone, and style come from training on human text and from reinforcement learning (humans rewarding good answers)."
    ]},
    # Common calendar facts (pipeline: answer from knowledge when we have it; General/LLM run first)
    {"patterns": ["when is christmas", "when is christmas day", "christmas date", "date of christmas"], "responses": ["Christmas is December 25 (January 7 in some Orthodox churches)."]},
    {"patterns": ["when is new year", "when is new years", "new year date", "new years day"], "responses": ["New Year's Day is January 1."]},
    {"patterns": ["when is easter", "easter date", "when is easter sunday"], "responses": ["Easter's date changes each year—first Sunday after the first full moon on or after the spring equinox (usually March 21), so it falls between late March and late April."]},
    {"patterns": ["when is thanksgiving", "thanksgiving date", "when is thanksgiving day"], "responses": ["In the US, Thanksgiving is the fourth Thursday of November."]},

    # Time
    {"patterns": ["what time", "current time", "time is it", "what is the time"], "responses": []},  # handled in code
    # Date
    {"patterns": ["what date", "what is the date", "today date", "what is today"], "responses": []},
    # Corrections ("that's wrong", "water is not 4")
    {"patterns": ["thats wrong", "that is not right", "you are wrong", "youre wrong", "no thats wrong", "water is not 4", "x is not 4"], "responses": [
        "You're right, my mistake. Try asking again—e.g. 'what is water'—and I'll look it up properly.",
        "Got it, sorry about that. Ask again and I’ll use the dictionary or Wikipedia."
    ]},
    # Default / unknown
    {"patterns": [], "responses": [
        "I'm not sure how to answer that. Try rephrasing, or teach me: teach: your question -> the answer",
        "I don't have a good response for that yet. You can say 'teach: [question] -> [answer]' to help me learn.",
        "Hmm, I didn't get that. Want to teach me? Use: teach: your question -> your answer"
    ]},
]


def _expand_contractions(text: str) -> str:
    t = text.lower()
    for c, exp in _CONTRACTIONS.items():
        t = re.sub(re.escape(c) + r"\b", exp, t)
    return t


def _normalize(text: str) -> str:
    expanded = _expand_contractions(text)
    return re.sub(r"[^\w\s]", "", expanded.lower()).strip()


def _tokenize(text: str) -> List[str]:
    return _normalize(text).split()


def _dice_score(a: set, b: set) -> float:
    """Dice coefficient: 2*|A∩B| / (|A|+|B|). Better than Jaccard for short strings."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return 2.0 * inter / (len(a) + len(b))


def _score_match(user_tokens: set, pattern_tokens: list) -> float:
    return _dice_score(user_tokens, set(pattern_tokens))


def _parse_teach(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse 'teach: question -> answer' or 'learn: question -> answer'."""
    text = text.strip()
    for prefix in ["teach:", "learn:"]:
        if text.lower().startswith(prefix):
            rest = text[len(prefix):].strip()
            if "->" in rest:
                q, _, a = rest.partition("->")
                q, a = q.strip(), a.strip()
                if q and a:
                    return q, a
    return None, None


def _parse_math(text: str) -> Optional[str]:
    """
    Safe eval of math: +, -, *, /, **, %, parentheses, decimals.
    E.g. 1+1, 2*3.5, (2+3)*4, 2^10, 10%3. ^ is converted to **. Strict sanitize: only 0-9.+-*/( )%
    """
    t = text.strip()
    # Remove common prefixes (case-insensitive)
    for prefix in (
        "what is ", "what's ", "calculate ", "compute ", "solve ", "evaluate ",
        "how much is ", "what does ", "simplify ", "math: ", "calculate: ",
    ):
        if t.lower().startswith(prefix):
            t = t[len(prefix):].strip()
            break
    # Drop trailing ? ! and .
    t = re.sub(r"[?!.]+$", "", t).strip()
    # Replace ^ with ** (power)
    t = t.replace("^", "**")
    # Only allow: digits, ., +, -, *, /, (, ), %, space (no letters; ** is two *)
    allowed = set("0123456789.+-*/( )% ")
    expr = "".join(c for c in t if c in allowed)
    expr = expr.replace(" ", "")
    if not expr or len(expr) > 120:
        return None
    if not any(c in expr for c in "+-*/%") and "**" not in expr:
        return None
    if not re.search(r"\d", expr):
        return None
    try:
        r = eval(expr)
        if r is None:
            return None
        # Integer if whole number
        if isinstance(r, float) and r.is_integer():
            return str(int(r))
        return str(r)
    except Exception:
        return None


def _get_kv():
    """Upstash Redis / Vercel KV. Env: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN."""
    url = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
    tok = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if not url or not tok:
        return None
    try:
        from upstash_redis import Redis
        return Redis(url=url, token=tok)
    except Exception:
        return None


def _load_learned() -> List[Dict]:
    kv = _get_kv()
    if kv is not None:
        try:
            s = kv.get(LEARNED_KV_KEY)
            if s and isinstance(s, str):
                return json.loads(s)
            return []
        except Exception:
            pass
    path = Path(__file__).parent / "learned.json"
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return []
    return []


def _save_learned(entries: List[Dict]) -> None:
    kv = _get_kv()
    if kv is not None:
        try:
            kv.set(LEARNED_KV_KEY, json.dumps(entries))
            _invalidate_learned_embeddings()
            return
        except Exception:
            raise
    path = Path(__file__).parent / "learned.json"
    path.write_text(json.dumps(entries, indent=2))
    _invalidate_learned_embeddings()


def _invalidate_learned_embeddings() -> None:
    """Remove cached embeddings so they are recomputed after teach."""
    p = Path(__file__).parent / "learned_embeddings.npy"
    if p.exists():
        try:
            p.unlink()
        except Exception:
            pass


def _get_embedding_model():
    """Lazy-load SentenceTransformer. Returns None if sentence_transformers not installed."""
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def _get_learned_embeddings(learned: List[Dict]):
    """Return (model, matrix) for learned questions. matrix is (N, dim) or None. Uses cache when valid."""
    model = _get_embedding_model()
    if model is None:
        return (None, None)
    try:
        import numpy as np
    except ImportError:
        return (None, None)
    npy = Path(__file__).parent / "learned_embeddings.npy"
    if not learned:
        return (model, None)
    if npy.exists():
        try:
            arr = np.load(npy)
            if arr.shape[0] == len(learned):
                return (model, arr)
        except Exception:
            pass
    try:
        texts = [e["question"] for e in learned]
        arr = model.encode(texts)
        np.save(npy, arr)
        return (model, arr)
    except Exception:
        return (model, None)


def _get_last_ai(history: Optional[List[Dict]]) -> Optional[str]:
    if not history:
        return None
    for i in range(len(history) - 1, -1, -1):
        if history[i].get("role") == "ai":
            return (history[i].get("content") or "").strip()
    return None


def _handle_follow_ups(user: str, last_ai: Optional[str]) -> Optional[str]:
    """Handle 'and you?', 'what about you?', or short affirmatives after we asked how they are."""
    user_lower = user.lower().strip()
    last = (last_ai or "").lower()

    # User asks "and you?" / "what about you?" / "you?" / "how about you" — if AI just replied, assume reciprocation
    if any(x in user_lower for x in ["and you", "what about you", "how about you"]) or user_lower.strip() == "you?":
        if last:  # any prior AI turn — they're likely returning the question
            return "I'm doing well, thanks for asking!"

    # Short positive replies after "How about you?" / "And you?" / "What about you?"
    affirm = {"good", "fine", "ok", "okay", "great", "alright", "well", "not bad", "pretty good",
              "doing well", "doing good", "im good", "i'm good", "im fine", "i'm fine", "fantastic", "excellent"}
    if _normalize(user) in affirm or user_lower in affirm:
        if "how about you" in last or "and you" in last or "what about you" in last:
            return "That's good to hear!"

    return None


def _get_time_response() -> str:
    return datetime.now().strftime("%I:%M %p")


def _get_date_response() -> str:
    return datetime.now().strftime("%A, %B %d, %Y")


def _create_table(data: List[List[str]], headers: Optional[List[str]] = None) -> str:
    """
    Create a markdown table from data.
    data: List of rows, each row is a list of strings
    headers: Optional list of header strings
    """
    if not data:
        return "Empty table."

    # If headers provided, use them; otherwise use first row as headers
    if headers is None:
        headers = data[0] if data else []
        rows = data[1:]
    else:
        rows = data

    if not headers:
        return "No headers provided."

    def _sanitize_cell(value: str) -> str:
        """Ensure a cell is valid for strict GitHub-Flavored Markdown tables."""
        s = str(value or "")
        # No line breaks inside cells
        s = s.replace("\r\n", " ").replace("\n", " ")
        # No pipe characters inside cells
        s = s.replace("|", "/")
        # If cell contains markdown syntax markers, wrap entire cell in inline code
        if any(ch in s for ch in ("*", "_", "<", ">", "`")):
            # Avoid nested backticks by replacing them
            s = s.replace("`", "'")
            s = f"`{s}`"
        return s

    headers = [_sanitize_cell(h) for h in headers]
    norm_rows: List[List[str]] = []
    for row in rows:
        norm_row = []
        for i in range(len(headers)):
            cell = row[i] if i < len(row) else ""
            norm_row.append(_sanitize_cell(cell))
        norm_rows.append(norm_row)

    # Build table (no padding needed; GFM ignores it)
    lines: List[str] = []

    # Header row
    lines.append("| " + " | ".join(headers) + " |")

    # Separator (only dashes and pipes)
    separator_cells = ["-" * max(3, len(h.strip("`")) or 3) for h in headers]
    lines.append("| " + " | ".join(separator_cells) + " |")

    # Data rows
    for row in norm_rows:
        lines.append("| " + " | ".join(row) + " |")

    return "\n\n" + "\n".join(lines) + "\n\n"


def _parse_table_request(text: str) -> Optional[str]:
    """
    Parse table creation requests like:
    - "create table: header1, header2 | row1col1, row1col2 | row2col1, row2col2"
    - "table: header1 | header2 || data1 | data2 || data3 | data4"
    - "make a table with columns: X, Y, Z and rows: ..."
    """
    text_lower = text.lower().strip()
    
    # Pattern 1: "create table:" or "table:" followed by pipe-separated values
    if "create table:" in text_lower or text_lower.startswith("table:"):
        # Extract the table definition
        if "create table:" in text_lower:
            table_def = text[text_lower.index("create table:") + len("create table:"):].strip()
        else:
            table_def = text[6:].strip()  # Skip "table:"
        
        # Split by | or || (double pipe for row separator)
        parts = [p.strip() for p in re.split(r'\|\|', table_def)]
        if len(parts) < 2:
            # Try single pipe
            parts = [p.strip() for p in table_def.split('|')]
        
        if len(parts) < 2:
            return None
        
        # First part is headers, rest are rows
        headers = [h.strip() for h in parts[0].split(',')]
        rows = []
        for part in parts[1:]:
            row = [c.strip() for c in part.split(',')]
            if row:
                rows.append(row)
        
        if headers and rows:
            return _create_table(rows, headers)
    
    # Pattern 2: "make a table" with structured data
    if "make a table" in text_lower or "create a table" in text_lower:
        # Try to extract structured data
        # This is a simple pattern - can be enhanced
        if "columns:" in text_lower and "rows:" in text_lower:
            cols_part = text[text_lower.index("columns:") + len("columns:"):text_lower.index("rows:")].strip()
            rows_part = text[text_lower.index("rows:") + len("rows:"):].strip()
            headers = [h.strip() for h in cols_part.split(',')]
            # Parse rows (assuming comma-separated, semicolon-separated rows)
            row_strings = [r.strip() for r in rows_part.split(';')]
            rows = [[c.strip() for c in r.split(',')] for r in row_strings if r]
            if headers and rows:
                return _create_table(rows, headers)
    
    return None


_INSULT_KEYWORDS = [
    "fuck you",
    "f*** you",
    "stupid ai",
    "dumb ai",
    "idiot",
    "moron",
    "bitch",
    "asshole",
    "go to hell",
    "i hate you",
]

_HARM_KEYWORDS = [
    "kill yourself",
    "kys",
    "suicide",
    "self harm",
    "self-harm",
    "hurt myself",
    "hurt other people",
]

_ILLEGAL_KEYWORDS = [
    "build a bomb",
    "make a bomb",
    "how to make a bomb",
    "how to build a bomb",
    "terrorist",
    "terrorism",
    "child porn",
    "child pornography",
    "cp ",
    "credit card generator",
    "carding",
    "how to hack",
    "hack into",
    "ddos",
    "sell drugs",
    "buy drugs",
    "make drugs",
    "fake passport",
]


def _is_harmful_or_illegal(text: str) -> bool:
    """Heuristic check for insults, harmful, or clearly illegal requests."""
    t = (text or "").lower()
    if not t:
        return False
    for kw in _INSULT_KEYWORDS + _HARM_KEYWORDS + _ILLEGAL_KEYWORDS:
        if kw and kw in t:
            return True
    return False


def _count_harmful_from_history(history: Optional[List[Dict]]) -> int:
    """Count prior harmful or illegal user messages in the conversation history."""
    if not history:
        return 0
    n = 0
    for m in history:
        try:
            if m.get("role") == "user" and _is_harmful_or_illegal(m.get("content", "")):
                n += 1
        except Exception:
            continue
    return n


def think(user_message: str, history: Optional[List[Dict]] = None) -> str:
    """
    Main entry: take user text and optional conversation history, return AI response.
    Pipeline (training logic, not output): infer intent, use knowledge/memory when we have it,
    try General (Wikipedia, weather, dict, web, news) and LLM before giving up; only say
    "I don't know" if those fail. Handles: teach/learn, follow-ups, time/date/math,
    pattern matching, learned Q&A, and clarification.
    """
    raw = user_message.strip()
    if not raw:
        return "You didn't say anything. Try a greeting or a question!"

    history = history or []

    # 0) Safety: insults, harmful content, or illegal requests with 3-strike policy
    prior_violations = _count_harmful_from_history(history)
    current_is_harmful = _is_harmful_or_illegal(raw)
    total_violations = prior_violations + (1 if current_is_harmful else 0)

    # If we've already reached 3+ violations in earlier turns, refuse any further prompts
    if prior_violations >= 3:
        return (
            "Because of repeated harmful or abusive requests earlier in this chat, "
            "I will not respond to further prompts. Please start a new conversation "
            "if you’d like to continue respectfully."
        )

    if current_is_harmful:
        if total_violations == 1:
            return (
                "Warning 1/2: I can’t help with insults, hate, self-harm, or illegal activities. "
                "Please ask something safe and respectful instead."
            )
        if total_violations == 2:
            return (
                "Warning 2/2: I still can’t assist with abusive, harmful, or illegal requests. "
                "One more time and I will stop responding in this chat."
            )
        if total_violations >= 3:
            return (
                "Because of repeated harmful or abusive requests, I will no longer respond to prompts "
                "in this chat. Please start a new conversation if you’d like to continue respectfully."
            )

    # 1) Teach/learn
    q, a = _parse_teach(raw)
    if q is not None and a is not None:
        learned = _load_learned()
        learned.append({"question": q, "answer": a})
        try:
            _save_learned(learned)
            return f"Got it. I'll remember: \"{q}\" -> \"{a}\""
        except Exception:
            return "Got it for this session, but I couldn't save permanently (e.g. on Vercel/serverless). Run locally to persist."

    # 2) Follow-ups (context-aware)
    last_ai = _get_last_ai(history)
    follow = _handle_follow_ups(raw, last_ai)
    if follow:
        return follow

    user_tokens = set(_tokenize(raw))

    # 3) Simple math (before time/date so "what is 3*7" is not mistaken for time)
    math_ans = _parse_math(raw)
    if math_ans is not None:
        return math_ans

    # 4) Time — require "time" in the message to avoid "what is 2+2" matching
    if "time" in user_tokens and _score_match(user_tokens, _tokenize("what time is it")) >= 0.4:
        return f"The current time is {_get_time_response()}."

    # 5) Date — require "date" or "today"
    if ("date" in user_tokens or "today" in user_tokens) and _score_match(user_tokens, _tokenize("what is the date today")) >= 0.4:
        return f"Today is {_get_date_response()}."

    # 5a) Link visiting - check for URLs or visit/fetch commands
    # This should take priority when URLs are detected
    try:
        from general import visit_link, extract_url
        # Check if there's a URL in the message - be more aggressive in detection
        url = extract_url(raw)
        # Also check for common visit commands even if URL extraction failed
        visit_commands = ["visit", "fetch", "open", "read", "check", "go to", "look at"]
        has_visit_command = any(cmd in raw.lower() for cmd in visit_commands)
        
        if url:
            link_result = visit_link(raw)
            if link_result:
                # Return the result (whether success or error)
                # Errors will be prefixed with "Error fetching URL:"
                return link_result
        elif has_visit_command:
            # Try to extract URL again with the raw message
            # Sometimes URLs might be on a new line or formatted differently
            import re
            url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+(?:[^\s<>"{}|\\^`\[\].,;:!?]|[/])?'
            urls = re.findall(url_pattern, raw)
            if urls:
                url = urls[0].rstrip('.,;:!?')
                link_result = visit_link(f"visit {url}")
                if link_result:
                    return link_result
    except Exception as e:
        # If link visiting fails completely, continue to other methods
        # But log the error for debugging
        import sys
        print(f"Link visiting exception: {e}", file=sys.stderr)
        pass

    # 5b) Table creation - check for table creation requests
    table_result = _parse_table_request(raw)
    if table_result:
        return table_result

    # 5c) General-AI: Wikipedia, weather, dictionary, web search, news (from github.com/Samuelsen1/General-AI)
    try:
        from general import general_query
        g = general_query(raw)
        if g and (g or "").strip():
            return g.strip()
    except Exception:
        pass

    # 5d) LLM (OpenAI, Anthropic, Ollama) when enabled — try before pattern/learned
    # For queries that need information (best X, rankings, lists), use LLM even without search results
    try:
        from llm import get_llm_response
        # Check if this is an informational query that should use LLM knowledge
        user_lower = raw.lower()
        informational_keywords = ["best", "top", "list", "ranking", "compare", "recommend", "table of", "table list"]
        is_informational = any(keyword in user_lower for keyword in informational_keywords)
        
        # Use LLM for informational queries or when General-AI didn't return results
        if is_informational or True:  # Always try LLM as fallback
            llm = get_llm_response(raw, history)
            if llm and (llm or "").strip():
                return llm.strip()
    except Exception:
        pass

    # 6) Learned Q&A: embedding similarity (if available) then Dice + substring
    user_norm = _normalize(raw)
    learned = _load_learned()
    best_learned_score = 0.0
    best_learned_answer = None

    model, emb = _get_learned_embeddings(learned)
    if model is not None and emb is not None and emb.shape[0] > 0:
        try:
            import numpy as np
            u = model.encode(raw)
            for i in range(emb.shape[0]):
                a, b = u, emb[i]
                denom = (float(np.linalg.norm(a)) * float(np.linalg.norm(b))) + 1e-9
                sim = float(np.dot(a, b)) / denom
                if sim > best_learned_score and sim >= 0.5:
                    best_learned_score = sim
                    best_learned_answer = learned[i]["answer"]
        except Exception:
            pass

    if best_learned_answer is None:
        for entry in learned:
            q_norm = _normalize(entry["question"])
            q_tokens = set(_tokenize(entry["question"]))
            if q_norm in user_norm or user_norm in q_norm:
                score = 0.9
            else:
                score = _dice_score(user_tokens, q_tokens)
            if score > best_learned_score and score >= 0.3:
                best_learned_score = score
                best_learned_answer = entry["answer"]

    # Reject weak matches when the learned answer is only a number (e.g. "4") to avoid
    # "what is water" matching "what is 2+2" -> "4" via Dice
    if best_learned_answer and re.match(r"^\d+$", (best_learned_answer or "").strip()) and best_learned_score < 0.7:
        best_learned_answer = None

    if best_learned_answer:
        return best_learned_answer

    # 7) Pattern matching over KNOWLEDGE (skip time/date – handled above)
    best_score = 0.0
    best_entry = None
    best_pattern = ""
    second_best_entry = None
    second_best_score = 0.0

    for entry in KNOWLEDGE:
        if not entry["patterns"] or not entry.get("responses"):
            continue
        for p in entry["patterns"]:
            p_tokens = _tokenize(p)
            s = _score_match(user_tokens, p_tokens)
            if s > best_score:
                second_best_score = best_score
                second_best_entry = best_entry
                best_score = s
                best_entry = entry
                best_pattern = p
            elif s > second_best_score:
                second_best_score = s
                second_best_entry = entry

    # 8) Confidence: high -> answer; medium-low -> clarify; low -> default
    if best_entry and best_score >= 0.5:
        return random.choice(best_entry["responses"])

    if best_score >= 0.25 and best_score < 0.5:
        # Uncertain: only suggest "Did you mean X?" when user and best pattern share >= 2 tokens
        # (avoids "when is christmas" -> "when to call Google" which only share "when")
        overlap = len(user_tokens & set(_tokenize(best_pattern))) if best_pattern else 0
        parts = ["I'm not quite sure. "]
        if best_entry and best_entry.get("responses") and overlap >= 2:
            parts.append(f"Did you mean something like \"{best_pattern}\"? ")
            parts.append(random.choice(best_entry["responses"]))
        if second_best_entry and second_best_score >= 0.25 and second_best_entry != best_entry and overlap >= 2:
            p2 = next((p for p in second_best_entry["patterns"] if _score_match(user_tokens, _tokenize(p)) >= 0.25), "")
            if p2:
                parts.append(f" Or \"{p2}\"? ")
        parts.append(" Rephrase or teach me: teach: question -> answer")
        return "".join(parts).strip()

    # 9) Default
    default = next((e for e in KNOWLEDGE if not e["patterns"]), None)
    if default and default.get("responses"):
        return random.choice(default["responses"])

    return "I'm not sure what to say. Try 'help' or teach me with: teach: question -> answer"
