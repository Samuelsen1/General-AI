/**
 * General – /api/chat
 * Free: Wikipedia, Open-Meteo (weather), Free Dictionary. Web: Google CSE, Serper, Brave, Tavily. News: NewsAPI. LLM: DeepSeek, OpenAI.
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

async function fetchSerper(q, apiKey) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  const items = (data?.organic || []).slice(0, 3);
  return items.map((i) => ({ title: i.title || "", snippet: trim(i.snippet || "", SNIPPET_MAX), link: i.link }));
}

async function fetchBrave(q, apiKey) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "X-Subscription-Token": apiKey }, signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  const items = (data?.web?.results || []).slice(0, 3);
  return items.map((i) => ({ title: i.title || "", snippet: trim(i.description || "", SNIPPET_MAX), link: i.url }));
}

async function fetchTavily(q, apiKey) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ query: q, search_depth: "basic" }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  const items = (data?.results || []).slice(0, 3);
  return items.map((i) => ({ title: i.title || "", snippet: trim(i.content || "", SNIPPET_MAX), link: i.url }));
}

async function fetchWeather(place) {
  const geo = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`;
  const g = await fetch(geo, { signal: AbortSignal.timeout(5000) });
  const gd = await g.json();
  const loc = gd?.results?.[0];
  if (!loc) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code`;
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const d = await r.json();
  const t = d?.current?.temperature_2m;
  const code = d?.current?.weather_code;
  const desc = { 0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 48: "foggy", 51: "drizzle", 61: "rain", 80: "rain", 95: "thunderstorm" }[code] || "—";
  return t != null ? `${loc.name}: ${Math.round(t)}°C, ${desc}.` : null;
}

async function fetchDictionary(term) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = await res.json();
  const e = data?.[0];
  const m = e?.meanings?.[0]?.definitions?.[0]?.definition;
  return m ? `${term}: ${trim(m, 200)}` : null;
}

async function fetchNews(q, apiKey) {
  const query = q.replace(/\b(news|latest|headlines|about|on)\b/gi, "").trim() || "news";
  const url = `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(query)}&pageSize=3&apiKey=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const data = await res.json();
  const items = (data?.articles || []).filter((a) => a?.title).slice(0, 3);
  return items.map((a) => ({ title: a.title, snippet: trim(a.description || "", 120) }));
}

const LLM_SYSTEM = `You are General, a helpful assistant. You have context from search (Wikipedia, web, weather, dictionary, news). Use it to answer.

Rules:
- When the context clearly supports an answer: give a clear, direct answer. Synthesize across sources if needed. 2–4 sentences is fine; be concise but complete.
- For definitions, facts, numbers, dates: state them directly.
- When the context is partial or ambiguous: say what we can infer, note what's unclear or missing, and suggest rephrasing if helpful.
- When the context doesn't match the question: briefly say so and what would help (e.g. "That's not in the context; try asking about X").
- Be natural and helpful. No filler like "According to the context" or "The context suggests." Just answer.
- If the user asks why/how: use the context to explain cause and effect when possible; otherwise keep it short.`;

async function fetchDeepSeek(context, question, apiKey) {
  const user = `Context:\n${context}\n\nQ: ${question}`;
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: LLM_SYSTEM }, { role: "user", content: user }],
      max_tokens: 420,
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

async function fetchOpenAI(context, question, apiKey) {
  const user = `Context:\n${context}\n\nQ: ${question}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: LLM_SYSTEM }, { role: "user", content: user }],
      max_tokens: 420,
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenAI ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

const LLM_VISION = "You are General. The user shared an image. Answer based on the image and any text context. Be concise and helpful.";

async function fetchDeepSeekWithImage(context, question, imageB64, apiKey) {
  const user = [
    { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
    { type: "text", text: "Context:\n" + context + "\n\nQ: " + question },
  ];
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: LLM_VISION }, { role: "user", content: user }],
      max_tokens: 420,
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(35000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

async function fetchOpenAIVision(context, question, imageB64, apiKey) {
  const user = [
    { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
    { type: "text", text: "Context:\n" + context + "\n\nQ: " + question },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: LLM_VISION }, { role: "user", content: user }],
      max_tokens: 420,
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenAI ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

function buildContext(opts) {
  const parts = [];
  if (opts.pdfText) parts.push("Document (PDF):\n" + opts.pdfText);
  if (opts.wiki?.length) parts.push("Wikipedia:\n" + opts.wiki.map((w) => `- ${w.title}: ${w.snippet}`).join("\n"));
  if (opts.web?.length) parts.push("Web:\n" + opts.web.map((g) => `- ${g.title}: ${g.snippet}`).join("\n"));
  if (opts.weather) parts.push("Weather: " + opts.weather);
  if (opts.definition) parts.push("Definition: " + opts.definition);
  if (opts.news?.length) parts.push("News:\n" + opts.news.map((n) => `- ${n.title}: ${n.snippet}`).join("\n"));
  return parts.join("\n\n") || "No search results.";
}

function buildFallbackReply(opts) {
  if (opts.weather) return opts.weather;
  if (opts.definition) return opts.definition;
  const best = opts.wiki?.[0] || opts.web?.[0];
  if (best) return `${best.title}: ${best.snippet}`;
  if (opts.news?.[0]) return `${opts.news[0].title}: ${opts.news[0].snippet}`;
  return "Nothing found. Rephrase or add API keys in Vercel.";
}

function extractPlace(q) {
  const s = q.toLowerCase().replace(/\b(weather|forecast|temperature|in|for|at)\b/g, "").trim();
  return s || null;
}

function extractDefineTerm(q) {
  const m = q.match(/(?:define|definition of|meaning of|what does)\s+(.+?)(?:\s+mean)?\s*$/i) || q.match(/^(.+?)\s+(?:mean|means)\s*$/i);
  return m ? m[1].trim() : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const message = body.message;
  const imageB64 = body.image;
  const pdfB64 = body.pdf;
  let q = (typeof message === "string" ? message.trim() : "") || "";
  if ((imageB64 || pdfB64) && !q) q = "What is in this file?";
  if (!q && !imageB64 && !pdfB64) return res.status(400).json({ error: "message or file required", reply: "Send a message or attach an image or PDF." });

  const ql = q.toLowerCase();
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  const serperKey = process.env.SERPER_API_KEY;
  const braveKey = process.env.BRAVE_API_KEY;
  const newsKey = process.env.NEWS_API_KEY;

  const opts = { wiki: [], web: [], weather: null, definition: null, news: [], pdfText: null };
  if (pdfB64) {
    try {
      const pdfParse = require("pdf-parse");
      const buf = Buffer.from(pdfB64, "base64");
      const data = await pdfParse(buf);
      opts.pdfText = (data.text || "").slice(0, 12000);
    } catch (e) { console.warn("PDF:", e?.message); }
  }

  try { opts.wiki = await fetchWikipedia(q); } catch (e) { console.warn("Wikipedia:", e?.message); }

  if (googleKey && cseId) { try { opts.web = await fetchGoogleSearch(q, googleKey, cseId); } catch (e) { console.warn("Google:", e?.message); } }
  else if (serperKey) { try { opts.web = await fetchSerper(q, serperKey); } catch (e) { console.warn("Serper:", e?.message); } }
  else if (braveKey) { try { opts.web = await fetchBrave(q, braveKey); } catch (e) { console.warn("Brave:", e?.message); } }
  else if (process.env.TAVILY_API_KEY) { try { opts.web = await fetchTavily(q, process.env.TAVILY_API_KEY); } catch (e) { console.warn("Tavily:", e?.message); } }

  if (/\b(weather|forecast|temperature)\b/.test(ql)) {
    const place = extractPlace(q);
    if (place) { try { opts.weather = await fetchWeather(place); } catch (e) { console.warn("Weather:", e?.message); } }
  }

  if (/\b(define|definition|meaning of|what does .+ mean)\b/i.test(q)) {
    const term = extractDefineTerm(q);
    if (term) { try { opts.definition = await fetchDictionary(term); } catch (e) { console.warn("Dictionary:", e?.message); } }
  }

  if (newsKey && /\b(news|latest|headlines|current|recent)\b/.test(ql)) {
    try { opts.news = await fetchNews(q, newsKey); } catch (e) { console.warn("News:", e?.message); }
  }

  const context = buildContext(opts);

  if (imageB64 && (deepseekKey || openaiKey)) {
    if (deepseekKey) {
      try {
        const reply = await fetchDeepSeekWithImage(context, q, imageB64, deepseekKey);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("DeepSeek vision:", e?.message); }
    }
    if (openaiKey) {
      try {
        const reply = await fetchOpenAIVision(context, q, imageB64, openaiKey);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("OpenAI vision:", e?.message); }
    }
    return res.status(200).json({ reply: "Image analysis needs DEEPSEEK_API_KEY or OPENAI_API_KEY in Vercel." });
  }

  if (context !== "No search results.") {
    if (deepseekKey) {
      try {
        const reply = await fetchDeepSeek(context, q, deepseekKey);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("DeepSeek:", e?.message); }
    }
    if (openaiKey) {
      try {
        const reply = await fetchOpenAI(context, q, openaiKey);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("OpenAI:", e?.message); }
    }
  }

  return res.status(200).json({ reply: buildFallbackReply(opts) });
}
