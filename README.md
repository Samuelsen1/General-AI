# General

**General** answers questions using Wikipedia, Google Search, and OpenAI. All legal, documented APIs.

## Sources

| Source | Env vars | Notes |
|--------|----------|-------|
| **Wikipedia** | — | Always on, free, no key |
| **Google Custom Search** | `GOOGLE_API_KEY`, `GOOGLE_CSE_ID` | [Get API key](https://console.cloud.google.com/apis/credentials); [Create CSE](https://programmablesearch.google.com/) (search the entire web) |
| **OpenAI** (gpt-4o-mini) | `OPENAI_API_KEY` | [API keys](https://platform.openai.com/api-keys) |

Without keys: Wikipedia only. With Google: Wikipedia + web search. With OpenAI: Wikipedia + search + AI synthesis.

## Set env vars on Vercel

1. Open your project on [vercel.com](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add:

   - `GOOGLE_API_KEY` – Google Cloud API key (Custom Search API enabled)
   - `GOOGLE_CSE_ID` – Programmable Search Engine ID (create one that searches the whole web)
   - `OPENAI_API_KEY` – OpenAI API key

3. **Redeploy** (Deployments → … → Redeploy).

## Deploy

See **[DEPLOY.md](DEPLOY.md)**. Deploy on Vercel; the `/api/chat` serverless function runs automatically.

## Run locally

- **Static only:** open `index.html` (uses fallback; no live search/AI).
- **With API:** `npx vercel dev` in the project folder, then open the URL it prints.
