/**
 * General – /api/chat
 * Uses: Wikipedia (free), Google Custom Search (env), OpenAI (env).
 * All legal, documented APIs. Keys in Vercel env.
 */

const WIKI_URL = "https://en.wikipedia.org/w/api.php";

const SNIPPET_MAX = 180;

function trim(s, n) { return (s || "").length <= n ? s : (s.slice(0, n).trim() + "..."); }

async function fetchWikipedia(q) {
  const url = `${WIKI_URL}?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const data = await res.json();
  const items = (data?.query?.search || []).slice(0, 3);
  return items.map((i) => ({ title: i.title, snippet: trim((i.snippet || "").replace(/<[^>]+>/g, ""), SNIPPET_MAX) }));
}

async function fetchGoogleSearch(q, apiKey, cseId) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(q)}&num=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  const items = (data?.items || []).slice(0, 3);
  return items.map((i) => ({ title: i.title, snippet: trim(i.snippet || "", SNIPPET_MAX), link: i.link }));
}

async function fetchOpenAI(context, question, apiKey) {
  const sys = `You are General. Answer only from the context. Rules:
- Be very concise: 1–3 short sentences. No intros, no filler.
- If the question asks for a definition, fact, date, or number: give it directly.
- If the context doesn’t contain enough: say "Not in the context" or what’s missing.
- No speculation. No "According to…" or "The context suggests…" — just answer.`;
  const user = `Context:\n${context}\n\nQ: ${question}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      max_tokens: 280,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || "No reply from model.";
}

function buildContext(wiki, google) {
  const parts = [];
  if (wiki?.length) parts.push("Wikipedia:\n" + wiki.map((w) => `- ${w.title}: ${w.snippet}`).join("\n"));
  if (google?.length) parts.push("Web:\n" + google.map((g) => `- ${g.title}: ${g.snippet}`).join("\n"));
  return parts.join("\n\n") || "No search results.";
}

function buildFallbackReply(wiki, google) {
  const best = (wiki?.[0] || google?.[0]);
  if (best) return `${best.title}: ${best.snippet}`;
  return "Nothing found. Rephrase or add API keys in Vercel.";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body || {};
  const q = typeof message === "string" ? message.trim() : "";
  if (!q) return res.status(400).json({ error: "message required", reply: "Ask something." });

  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  let wiki = [];
  let google = [];

  try {
    wiki = await fetchWikipedia(q);
  } catch (e) {
    console.warn("Wikipedia error:", e?.message);
  }

  if (googleKey && cseId) {
    try {
      google = await fetchGoogleSearch(q, googleKey, cseId);
    } catch (e) {
      console.warn("Google Search error:", e?.message);
    }
  }

  const context = buildContext(wiki, google);

  if (openaiKey && context !== "No search results.") {
    try {
      const reply = await fetchOpenAI(context, q, openaiKey);
      return res.status(200).json({ reply });
    } catch (e) {
      console.warn("OpenAI error:", e?.message);
    }
  }

  const reply = buildFallbackReply(wiki, google);
  return res.status(200).json({ reply });
}
