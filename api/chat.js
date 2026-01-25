/**
 * General – /api/chat
 * Uses: Wikipedia (free), Google Custom Search (env), OpenAI (env).
 * All legal, documented APIs. Keys in Vercel env.
 */

const WIKI_URL = "https://en.wikipedia.org/w/api.php";

async function fetchWikipedia(q) {
  const url = `${WIKI_URL}?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const data = await res.json();
  const items = (data?.query?.search || []).slice(0, 4);
  return items.map((i) => ({ title: i.title, snippet: (i.snippet || "").replace(/<[^>]+>/g, "") }));
}

async function fetchGoogleSearch(q, apiKey, cseId) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(q)}&num=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  const items = (data?.items || []).slice(0, 4);
  return items.map((i) => ({ title: i.title, snippet: i.snippet || "", link: i.link }));
}

async function fetchOpenAI(context, question, apiKey) {
  const sys = `You are General, an AI that answers using the provided context from Wikipedia and web search. Be concise and factual. If the context doesn't support an answer, say so.`;
  const user = `Context:\n${context}\n\nQuestion: ${question}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      max_tokens: 600,
      temperature: 0.3,
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
  const parts = [];
  if (wiki?.length) parts.push(wiki.map((w) => `${w.title}: ${w.snippet}`).join("\n\n"));
  if (google?.length) parts.push(google.map((g) => `${g.title}: ${g.snippet}`).join("\n\n"));
  return parts.join("\n\n") || "I couldn't find relevant information. Try rephrasing or add GOOGLE_API_KEY, GOOGLE_CSE_ID, and OPENAI_API_KEY in Vercel for more power.";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body || {};
  const q = typeof message === "string" ? message.trim() : "";
  if (!q) return res.status(400).json({ error: "message required", reply: "Please ask a question." });

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
