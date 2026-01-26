"""
General-AI sources: Wikipedia, weather, dictionary, web search, news.
Port of https://github.com/Samuelsen1/General-AI – fetch, build context, synthesize with OpenAI.
"""

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional
from html.parser import HTMLParser

WIKI_URL = "https://en.wikipedia.org/w/api.php"
SNIPPET_MAX = 180


def _trim(s: Optional[str], n: int) -> str:
    if not s:
        return ""
    return s if len(s) <= n else (s[:n].rstrip() + "...")


def _get(url: str, timeout: int = 8, headers: Optional[Dict[str, str]] = None) -> Dict:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def _post(url: str, data: Dict, api_key: Optional[str], timeout: int = 10, header_key: str = "X-API-KEY") -> Dict:
    body = json.dumps(data).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if api_key:
        h[header_key] = api_key
    req = urllib.request.Request(url, data=body, headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def fetch_wikipedia(q: str) -> List[Dict[str, str]]:
    url = f"{WIKI_URL}?action=query&list=search&srsearch={urllib.parse.quote(q)}&format=json&origin=*&srlimit=5"
    try:
        data = _get(url, timeout=6)
        items = (data.get("query") or {}).get("search") or []
        out = []
        for i in items[:3]:
            snip = (i.get("snippet") or "").replace("<", " ").replace(">", " ")
            snip = re.sub(r"<[^>]+>", "", snip)
            out.append({"title": i.get("title", ""), "snippet": _trim(snip, SNIPPET_MAX)})
        return out
    except Exception:
        return []


def fetch_weather(place: str) -> Optional[str]:
    try:
        geo = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(place)}&count=1"
        gd = _get(geo, timeout=5)
        loc = (gd.get("results") or [None])[0]
        if not loc:
            return None
        lat, lon = loc.get("latitude"), loc.get("longitude")
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code"
        d = _get(url, timeout=5)
        cur = d.get("current") or {}
        t = cur.get("temperature_2m")
        code = cur.get("weather_code")
        desc = {
            0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
            45: "foggy", 48: "foggy", 51: "drizzle", 61: "rain", 80: "rain", 95: "thunderstorm",
        }.get(code, "—")
        if t is not None:
            return f"{loc.get('name', place)}: {round(float(t))}°C, {desc}."
        return None
    except Exception:
        return None


def fetch_dictionary(term: str) -> Optional[str]:
    """Free Dictionary API: meanings, phonetics, definitions, examples, synonyms."""
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(term)}"
    try:
        data = _get(url, timeout=5)
        e = (data or [None])[0]
        if not e:
            return None
        out: List[str] = []
        # Phonetic(s)
        phonetics = e.get("phonetics") or []
        phon = next((p.get("text") for p in phonetics if p.get("text")), None) or e.get("phonetic")
        if phon:
            out.append(f"{term} [{phon}]")
        else:
            out.append(term)
        # Meanings: partOfSpeech + definitions (definition, example), synonyms
        for m in (e.get("meanings") or [])[:4]:
            pos = (m.get("partOfSpeech") or "").strip()
            pos_label = f" ({pos})" if pos else ""
            defs = m.get("definitions") or []
            for i, d in enumerate(defs[:3], 1):
                df = (d.get("definition") or "").strip()
                if df:
                    out.append(f"  {i}.{pos_label} {_trim(df, 150)}")
                ex = (d.get("example") or "").strip()
                if ex:
                    out.append(f"     Example: {_trim(ex, 100)}")
            syns = [s for s in (m.get("synonyms") or [])[:5] if isinstance(s, str) and s.strip()]
            if syns:
                out.append(f"     Synonyms: {', '.join(syns[:5])}")
        return "\n".join(out) if len(out) > 1 else None
    except Exception:
        return None


def fetch_datamuse(term: str) -> Optional[str]:
    """Datamuse API (no key): spell + definitions (md=d)."""
    url = f"https://api.datamuse.com/words?sp={urllib.parse.quote(term)}&md=d"
    try:
        data = _get(url, timeout=5)
        items = [x for x in (data or []) if isinstance(x, dict) and x.get("defs")]
        if not items:
            return None
        parts: List[str] = []
        for it in items[:2]:
            word = it.get("word", term)
            defs = it.get("defs") or []
            for d in defs[:3]:
                if isinstance(d, str) and "\t" in d:
                    _, df = d.split("\t", 1)
                    if df.strip():
                        parts.append(f"  • {_trim(df.strip(), 120)}")
        return f"Datamuse — {term}:\n" + "\n".join(parts) if parts else None
    except Exception:
        return None


def fetch_wiktionary(term: str) -> Optional[str]:
    """Wiktionary API: extract intro for the term."""
    url = "https://en.wiktionary.org/w/api.php"
    params = f"action=query&titles={urllib.parse.quote(term)}&prop=extracts&exintro&explaintext&format=json"
    try:
        data = _get(f"{url}?{params}", timeout=6)
        pages = (data.get("query") or {}).get("pages") or {}
        for pid, p in pages.items():
            if pid == "-1":
                continue
            ext = (p or {}).get("extract") or ""
            if ext.strip():
                return f"Wiktionary — {term}:\n{_trim(ext.strip(), 400)}"
        return None
    except Exception:
        return None


def fetch_merriam_webster(term: str, api_key: str) -> Optional[str]:
    """Merriam-Webster Collegiate (dictionaryapi.com). Requires API key."""
    url = f"https://www.dictionaryapi.com/api/v3/references/collegiate/json/{urllib.parse.quote(term)}?key={urllib.parse.quote(api_key)}"
    try:
        data = _get(url, timeout=6)
        if not isinstance(data, list) or not data:
            return None
        # If the API returns suggestions (list of strings), term was not found
        first = data[0]
        if isinstance(first, str):
            return None
        parts: List[str] = []
        for e in data[:2]:
            fl = (e.get("fl") or "").strip()
            short = e.get("shortdef") or []
            for i, d in enumerate(short[:2], 1):
                if d and isinstance(d, str):
                    label = f"  {i}. ({fl})" if fl else f"  {i}."
                    parts.append(f"{label} {_trim(d, 120)}")
        return f"Merriam-Webster — {term}:\n" + "\n".join(parts) if parts else None
    except Exception:
        return None


def fetch_google_search(q: str, api_key: str, cse_id: str) -> List[Dict[str, str]]:
    url = f"https://www.googleapis.com/customsearch/v1?key={api_key}&cx={cse_id}&q={urllib.parse.quote(q)}&num=5"
    try:
        data = _get(url, timeout=8)
        items = (data.get("items") or [])[:3]
        return [{"title": i.get("title", ""), "snippet": _trim(i.get("snippet", ""), SNIPPET_MAX), "link": i.get("link", "")} for i in items]
    except Exception:
        return []


def fetch_serper(q: str, api_key: str) -> List[Dict[str, str]]:
    try:
        data = _post("https://google.serper.dev/search", {"q": q}, api_key=api_key, header_key="X-API-KEY", timeout=8)
        items = (data.get("organic") or [])[:3]
        return [{"title": i.get("title", ""), "snippet": _trim(i.get("snippet", ""), SNIPPET_MAX), "link": i.get("link", "")} for i in items]
    except Exception:
        return []


def fetch_brave(q: str, api_key: str) -> List[Dict[str, str]]:
    url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(q)}"
    try:
        req = urllib.request.Request(url, headers={"X-Subscription-Token": api_key})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode())
        items = (data.get("web") or {}).get("results") or []
        return [{"title": i.get("title", ""), "snippet": _trim(i.get("description", ""), SNIPPET_MAX), "link": i.get("url", "")} for i in items[:3]]
    except Exception:
        return []


def fetch_tavily(q: str, api_key: str) -> List[Dict[str, str]]:
    try:
        req = urllib.request.Request(
            "https://api.tavily.com/search",
            data=json.dumps({"query": q, "search_depth": "basic"}).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        items = (data.get("results") or [])[:3]
        return [{"title": i.get("title", ""), "snippet": _trim(i.get("content", ""), SNIPPET_MAX), "link": i.get("url", "")} for i in items]
    except Exception:
        return []


def fetch_news(q: str, api_key: str) -> List[Dict[str, str]]:
    q2 = re.sub(r"\b(news|latest|headlines|about|on)\b", "", q, flags=re.I).strip() or "news"
    url = f"https://newsapi.org/v2/top-headlines?q={urllib.parse.quote(q2)}&pageSize=3&apiKey={api_key}"
    try:
        data = _get(url, timeout=6)
        items = [a for a in (data.get("articles") or []) if a.get("title")][:3]
        return [{"title": a.get("title", ""), "snippet": _trim(a.get("description", ""), 120)} for a in items]
    except Exception:
        return []


def extract_place(q: str) -> Optional[str]:
    s = re.sub(r"\b(weather|forecast|temperature|in|for|at)\b", "", q, flags=re.I).strip()
    return s or None


def extract_define_term(q: str) -> Optional[str]:
    """Extract word or phrase to look up from define/explain/meaning questions. Also accepts short bare phrases (1–4 words) as the term."""
    q = q.strip()
    # Explicit: "define X", "explain X", "what does X mean", "meaning of X", "explain the word X", "explain the phrase X", etc.
    patterns = [
        r"(?:define|definition of|meaning of|what does)\s+(.+?)(?:\s+mean)?\s*[.?!]?\s*$",
        r"^(?!what\s+does\s)(.+?)\s+(?:mean|means)\s*[.?!]?\s*$",
        r"(?:explain|explain the word|explain the phrase|define the word|define the phrase)\s+(.+?)\s*[.?!]?\s*$",
        r"(?:what is the meaning of|what is the definition of)\s+(.+?)\s*[.?!]?\s*$",
        r"^(?:what is|what's)\s+(\w+(?:\s+\w+)?)\s*[.?!]?\s*$",
        r"(?:word|phrase|term)\s+[\"']?(.+?)[\"']?\s*[.?!]?\s*$",
    ]
    for pat in patterns:
        m = re.search(pat, q, re.I)
        if m:
            t = m.group(1).strip()
            if not t or len(t) >= 80:
                continue
            if t.lower() in ("the", "a", "an"):
                continue
            if re.match(r"^[\d\s.+\-*/( )%^]+$", t):
                return None  # math-like term, not a definition query
            return t
    # Bare short phrase (1–4 words): use as term for lookups; skip if it looks like math
    if 1 <= len(q.split()) <= 4 and len(q) < 50:
        if re.match(r"^[\d\s.+\-*/( )%^]+$", q):
            return None  # math expression
        return q
    return None


def build_context(opts: Dict[str, Any]) -> str:
    parts = []
    if opts.get("wiki"):
        parts.append("Wikipedia:\n" + "\n".join(f"- {w['title']}: {w['snippet']}" for w in opts["wiki"]))
    if opts.get("web"):
        parts.append("Web:\n" + "\n".join(f"- {g['title']}: {g['snippet']}" for g in opts["web"]))
    if opts.get("weather"):
        parts.append("Weather: " + opts["weather"])
    if opts.get("definition"):
        parts.append("Definition: " + opts["definition"])
    if opts.get("news"):
        parts.append("News:\n" + "\n".join(f"- {n['title']}: {n['snippet']}" for n in opts["news"]))
    return "\n\n".join(parts) or "No search results."


def build_fallback_reply(opts: Dict[str, Any]) -> str:
    if opts.get("weather"):
        return opts["weather"]
    if opts.get("definition"):
        return opts["definition"]
    best = (opts.get("wiki") or [None])[0] or (opts.get("web") or [None])[0]
    if best:
        return f"{best.get('title', '')}: {best.get('snippet', '')}"
    if (opts.get("news") or [None])[0]:
        return f"{opts['news'][0]['title']}: {opts['news'][0]['snippet']}"
    return "Nothing found. Rephrase or add API keys (see ENV.md)."


def _fetch_web(q: str) -> List[Dict[str, str]]:
    gk, cse = os.environ.get("GOOGLE_API_KEY"), os.environ.get("GOOGLE_CSE_ID")
    if gk and cse:
        return fetch_google_search(q, gk, cse)
    sk = os.environ.get("SERPER_API_KEY")
    if sk:
        return fetch_serper(q, sk)
    bk = os.environ.get("BRAVE_API_KEY")
    if bk:
        return fetch_brave(q, bk)
    tk = os.environ.get("TAVILY_API_KEY")
    if tk:
        return fetch_tavily(q, tk)
    return []


def is_chitchat(q: str) -> bool:
    t = re.sub(r"[^\w\s]", "", q.lower()).strip().split()
    chitchat = {"hi", "hello", "hey", "thanks", "thank", "bye", "ok", "okay"}
    return len(t) <= 2 and (set(t) & chitchat) == set(t)


def general_query_sources(q: str) -> Dict[str, Any]:
    opts: Dict[str, Any] = {"wiki": [], "web": [], "weather": None, "definition": None, "news": []}
    ql = q.lower()
    opts["wiki"] = fetch_wikipedia(q)
    opts["web"] = _fetch_web(q)
    if re.search(r"\b(weather|forecast|temperature)\b", ql):
        place = extract_place(q)
        if place:
            opts["weather"] = fetch_weather(place)
    # Definition: whenever we detect a term (define/explain/meaning/bare phrase)
    term = extract_define_term(q)
    if term:
        defs: List[str] = []
        fd = fetch_dictionary(term)
        if fd:
            defs.append("Free Dictionary:\n" + fd)
        dm = fetch_datamuse(term)
        if dm:
            defs.append(dm)
        wk = fetch_wiktionary(term)
        if wk:
            defs.append(wk)
        mw_key = os.environ.get("MERRIAM_WEBSTER_API_KEY") or os.environ.get("DICTIONARY_API_KEY")
        if mw_key:
            mw = fetch_merriam_webster(term, mw_key)
            if mw:
                defs.append(mw)
        opts["definition"] = "\n\n".join(defs)[:1200] if defs else None
    if os.environ.get("NEWS_API_KEY") and re.search(r"\b(news|latest|headlines|current|recent)\b", ql):
        opts["news"] = fetch_news(q, os.environ["NEWS_API_KEY"])
    return opts


def general_synthesize(context: str, question: str) -> Optional[str]:
    key = os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENAI_KEY")
    if not (key or "").strip():
        return None
    
    # Base system prompt
    sys = """You are General. Answer only from the context. Rules:
- Be very concise: 1–3 short sentences. No intros, no filler.
- If the question asks for a definition, fact, date, or number: give it directly.
- If the context doesn't contain enough: say "Not in the context" or what's missing.
- No speculation. No "According to…" or "The context suggests…" — just answer."""
    
    # Add judgment instructions for scoring/evaluation queries
    question_lower = question.lower()
    scoring_keywords = ["score", "rate", "evaluate", "grade", "assess", "judge", "quality", "poor", "bad", "good", "excellent"]
    is_scoring_query = any(keyword in question_lower for keyword in scoring_keywords)
    
    if is_scoring_query:
        sys += """
- **CRITICAL for scoring/evaluation**: Use a realistic 0-100% scale. Poor work = 40-60%, not 80%+. Good work = 75-85%. Excellent = 90%+. Be judgmental: if work is poor, score it 40-60%. Justify with specific issues, errors, or deficiencies. Don't inflate scores."""
    
    user = f"Context:\n{context}\n\nQ: {question}"
    try:
        from openai import OpenAI

        client = OpenAI(api_key=key)
        r = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[{"role": "system", "content": sys}, {"role": "user", "content": user}],
            max_tokens=280,
            temperature=0.2,
        )
        c = (r.choices or [None])[0]
        if c and getattr(c, "message", None):
            return (getattr(c.message, "content", None) or "").strip()
    except Exception:
        pass
    return None


def general_query(q: str) -> Optional[str]:
    """
    Run General-AI pipeline: Wikipedia, weather, dictionary, web, news.
    If context exists: synthesize with OpenAI else build_fallback_reply.
    Returns None if is_chitchat or no usable result.
    """
    if is_chitchat(q):
        return None
    opts = general_query_sources(q)
    context = build_context(opts)
    if context == "No search results.":
        return None
    syn = general_synthesize(context, q)
    if syn:
        return syn
    return build_fallback_reply(opts)


class HTMLTextExtractor(HTMLParser):
    """Extract text from HTML, ignoring scripts and styles."""
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip_tags = {'script', 'style', 'meta', 'link', 'noscript'}
        self.skip = False
    
    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.skip = True
    
    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.skip = False
        elif tag in ('p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.text.append('\n')
    
    def handle_data(self, data):
        if not self.skip:
            self.text.append(data.strip())
    
    def get_text(self) -> str:
        text = ' '.join(self.text)
        # Clean up multiple spaces and newlines
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n\s*\n', '\n\n', text)
        return text.strip()


def extract_url(text: str) -> Optional[str]:
    """Extract first URL from text. Handles 'visit', 'fetch', 'open' commands and bare URLs."""
    # First, try to find any URL in the text (most reliable)
    # Pattern to match full URLs (with scheme) - more lenient
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+(?:[^\s<>"{}|\\^`\[\].,;:!?]|[/])'
    urls = re.findall(url_pattern, text)
    if urls:
        # Clean up the URL (remove trailing punctuation that might have been captured)
        url = urls[0].rstrip('.,;:!?')
        return url
    
    # Check for commands like "visit this link: URL" or "visit example.com" (with or without scheme)
    # More flexible: allows text between command and URL
    visit_pattern = r'(?:visit|fetch|open|read|check|go to|look at|see|browse)[\s:]+(?:this\s+)?(?:link|url|site|page|website)?[\s:]*\s*(https?://[^\s<>"{}|\\^`\[\]]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}[^\s]*)'
    match = re.search(visit_pattern, text, re.I)
    if match:
        url = match.group(1).rstrip('.,;:!?')
        # Add scheme if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        return url
    
    # Check for bare domain patterns (e.g., "example.com" or "www.example.com")
    # Only if it looks like a domain (has TLD)
    bare_domain_pattern = r'\b(?:https?://)?(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:/[^\s<>"{}|\\^`\[\]]*)?\b'
    domain_match = re.search(bare_domain_pattern, text)
    if domain_match:
        url = domain_match.group(0).rstrip('.,;:!?')
        # Add scheme if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        return url
    
    return None


def fetch_webpage(url: str) -> Optional[str]:
    """Fetch and extract text content from a webpage."""
    try:
        # Ensure URL has a scheme
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req, timeout=10) as response:
            content_type = response.headers.get('Content-Type', '').lower()
            if 'html' not in content_type:
                # Try to read as text anyway
                content = response.read().decode('utf-8', errors='ignore')
                return _trim(content, 2000)
            
            html = response.read().decode('utf-8', errors='ignore')
            parser = HTMLTextExtractor()
            parser.feed(html)
            text = parser.get_text()
            return _trim(text, 2000) if text else None
    except urllib.error.HTTPError as e:
        return f"Error fetching URL: HTTP {e.code} {e.reason}"
    except urllib.error.URLError as e:
        return f"Error fetching URL: {e.reason}"
    except Exception as e:
        return f"Error fetching URL: {str(e)}"


def visit_link(query: str) -> Optional[str]:
    """Visit a link from user query. Returns summary or None."""
    url = extract_url(query)
    if not url:
        return None
    
    content = fetch_webpage(url)
    if content:
        return f"Content from {url}:\n\n{content}"
    return None


def get_status() -> Dict[str, Any]:
    """Which General sources are configured (no secrets)."""
    g = bool(os.environ.get("GOOGLE_API_KEY") and os.environ.get("GOOGLE_CSE_ID"))
    s = bool(os.environ.get("SERPER_API_KEY"))
    b = bool(os.environ.get("BRAVE_API_KEY"))
    t = bool(os.environ.get("TAVILY_API_KEY"))
    web = "google" if g else "serper" if s else "brave" if b else "tavily" if t else None
    return {
        "wikipedia": True,
        "weather": True,
        "dictionary": True,
        "dictionary_sources": ["free_dictionary", "datamuse", "wiktionary"] + (["merriam_webster"] if bool(os.environ.get("MERRIAM_WEBSTER_API_KEY") or os.environ.get("DICTIONARY_API_KEY")) else []),
        "web": web,
        "news": bool(os.environ.get("NEWS_API_KEY")),
        "openai": bool(os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENAI_KEY")),
        "link_visiting": True,
    }
