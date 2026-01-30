# Environment variables (Vercel)

Set in **Vercel → Your project → Settings → Environment Variables**, then **Redeploy**.

---

## No key (always on)

- **Wikipedia** — general search
- **Open-Meteo** — weather (e.g. “weather in Berlin”)
- **Free Dictionary API** — definitions (e.g. “define photosynthesis”)

---

## Web search (use one)

| Variable | Service | Where to get it |
|----------|---------|------------------|
| `GOOGLE_API_KEY` | Google Custom Search | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → API key; enable **Custom Search API** |
| `GOOGLE_CSE_ID` | Google CSE | [Programmable Search](https://programmablesearch.google.com/) → create engine → **Search the entire web** → copy **Search engine ID** |
| `SERPER_API_KEY` | Serper (Google) | [serper.dev](https://serper.dev) → API key |
| `BRAVE_API_KEY` | Brave Search | [Brave Search API](https://brave.com/search/api/) → Subscription token |
| `TAVILY_API_KEY` | Tavily | [tavily.com](https://tavily.com) → API key |

**Priority:** Google CSE → Serper → Brave → Tavily (first configured is used).

---

## News

| Variable | Service | Where to get it |
|----------|---------|------------------|
| `NEWS_API_KEY` | NewsAPI | [newsapi.org](https://newsapi.org/register) → API key (free: top-headlines) |

Used when the query contains: *news*, *latest*, *headlines*, *current*, *recent*.

---

## LLM (synthesis)

| Variable | Service | Where to get it |
|----------|---------|------------------|
| `DEEPSEEK_API_KEY` | DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) → API keys → Create new |
| `OPENAI_API_KEY` | OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

**Priority:** DeepSeek is used first when configured; otherwise OpenAI.

---

All keys are optional. General always uses Wikipedia, weather, and dictionary when the query fits.
