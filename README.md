# General

**General** answers using Wikipedia, web search, weather, definitions, news, and OpenAI. All legal, documented APIs.

## Sources

| Source | Env vars | Notes |
|--------|----------|-------|
| **Wikipedia** | — | Always on, free |
| **Weather** (Open-Meteo) | — | Free. Try: "weather in Berlin" |
| **Dictionary** (Free Dictionary API) | — | Free. Try: "define photosynthesis" |
| **Web search** | `GOOGLE_API_KEY`+`GOOGLE_CSE_ID`, or `SERPER_API_KEY`, or `BRAVE_API_KEY`, or `TAVILY_API_KEY` | One of. [Google CSE](https://programmablesearch.google.com/) \| [Serper](https://serper.dev) \| [Brave](https://brave.com/search/api/) \| [Tavily](https://tavily.com) |
| **News** (NewsAPI) | `NEWS_API_KEY` | [newsapi.org](https://newsapi.org/register). Queries with "news", "latest", "headlines" |
| **OpenAI** (gpt-4o-mini) | `OPENAI_API_KEY` | [OpenAI API keys](https://platform.openai.com/api-keys). Synthesizes from context |

See **[ENV.md](ENV.md)** for how to get each key.

## Set env vars on Vercel

1. **Vercel** → your project → **Settings** → **Environment Variables**
2. Add any of: `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`, `SERPER_API_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY`, `NEWS_API_KEY`, `OPENAI_API_KEY`. Check `/api/status` to see which are active.
3. **Redeploy**

## Deploy

See **[DEPLOY.md](DEPLOY.md)**. Deploy on Vercel; `/api/chat` runs as serverless.

## Run locally

- **Static:** open `index.html` (fallback only)
- **With API:** `npx vercel dev` in the project folder
