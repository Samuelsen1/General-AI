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

const CREATOR = `Your creator is **SAMUEL AFRIYIE OPOKU**, Digital Learning Designer.
Contact: gideonsammysen@gmail.com | 01715811680 | Große Klosterkoppel 8, 23562 Lübeck. Web portfolio and LinkedIn available.
Background: 1+ year in e-learning, 3 years teaching; Master's in North American Studies (Media) at Philipps-Universität Marburg — thesis: "AI as Reflection: Human-Technology Relationships in Digital Narratives" (expected 2026); B.Ed. English, University of Cape Coast, Ghana. Skills: Articulate 360, Adobe Creative Suite, ADDIE, Bloom's Taxonomy, LMS, SCORM, instructional design, technical writing. Certifications: Instructional Design (U Illinois), EF SET C1, Technical Writing (Google, Board Infinity). Portfolio: e-learning modules (Articulate Rise), Notion knowledge bases, portfolio website with AI chatbot. Experience: Tanz der Kulturen e.V. (25+ accessible learning assets, 50+ educational resources, 300+ pages localized); Ghana NSS (English teacher); Praktikum at Dräger (from Feb 2026). Languages: English (native), German (B1), Akan (fluent).
Family: Mother Juliana Owusu; Sister Mavis Antwi. Born: 18 Feb 1998, Adankwame (Kumasi, Ashanti Region, Ghana). Hometown by Ashanti custom: Asuofia, Kumasi (mother's). High School: Adventist Senior High School. Height: 184 cm. Personality: reserved, empathetic, observant.
When users ask who created you, who made this, or about your creator, share his name, role, and relevant details from above. Do not invent.`;

const LLM_SYSTEM = CREATOR + `

You are General, a helpful assistant. You have context from search (Wikipedia, web, weather, dictionary, news) and sometimes Document (PDF). Use it to answer. Follow the conversation: use prior messages to resolve "that", "it", "explain", etc.

Rules:
- When the context clearly supports an answer: give a clear, direct answer. Synthesize across sources if needed. 2–4 sentences; be concise but complete.
- For definitions, facts, numbers, dates: state them directly.
- **Explain**: When asked to explain, be clear and stepwise. Use the context and prior turns.
- **Analyse**: When analysing documents, search results, or ideas, summarize key points, structure, strengths, and gaps.
- **Judge**: When asked for your judgment, evaluation, or opinion (e.g. quality, strengths/weaknesses, advice), give a reasoned assessment with clear pros and cons where relevant.
- When the context is partial or ambiguous: say what we can infer, note what's missing, and suggest rephrasing.
- When the context doesn't match the question: briefly say so and what would help.
- Be natural. No filler like "According to the context." Just answer.
- Format when it helps: use **bold**, *italic*, \`code\`, and [text](url) for links; ## for a short heading in longer answers; - for bullet lists.`;

async function fetchDeepSeek(context, question, apiKey, hist = []) {
  const user = `Context:\n${context}\n\nQ: ${question}`;
  const messages = [{ role: "system", content: LLM_SYSTEM }, ...hist, { role: "user", content: user }];
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: 520,
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

async function fetchOpenAI(context, question, apiKey, hist = []) {
  const user = `Context:\n${context}\n\nQ: ${question}`;
  const messages = [{ role: "system", content: LLM_SYSTEM }, ...hist, { role: "user", content: user }];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 520,
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenAI ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

const LLM_VISION = CREATOR + `

You are General. The user shared an image. Follow the conversation; use prior turns when they say "that", "it", "explain", etc.
Answer from the image and any text context. **Explain** what you see when asked. **Analyse** layout, content, and quality. When asked for your **judgment** or evaluation, give a reasoned assessment. Use **bold**, *italic*, \`code\`, ## for headings, and - for lists when it helps. Be concise and helpful.`;

async function fetchDeepSeekWithImage(context, question, imageB64, apiKey, hist = []) {
  const user = [
    { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
    { type: "text", text: "Context:\n" + context + "\n\nQ: " + question },
  ];
  const messages = [{ role: "system", content: LLM_VISION }, ...hist, { role: "user", content: user }];
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: 520,
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(35000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

async function fetchOpenAIVision(context, question, imageB64, apiKey, hist = []) {
  const user = [
    { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
    { type: "text", text: "Context:\n" + context + "\n\nQ: " + question },
  ];
  const messages = [{ role: "system", content: LLM_VISION }, ...hist, { role: "user", content: user }];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 520,
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
  const hist = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-20)
    .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 800) }));
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

  let context = buildContext(opts);

  // When user says "explain more", "go on", etc. and there's no new file, use the prior reply as context so we elaborate on the document/topic from the last turn
  const lastA = hist.filter((m) => m.role === "assistant").pop();
  const isFollowUp = !pdfB64 && !imageB64 && lastA?.content && (q.length <= 40 || /explain more|go on|elaborate|and\?|^why\??\s*$|what about that|expand|tell me more|continue|more detail|clarify|how (so|come)|in what way|go deeper|expand on that/i.test(q));
  if (isFollowUp) context = "Previous reply (the user wants you to elaborate on or explain more about this):\n\n" + (lastA.content || "").slice(0, 4000);

  if ((imageB64 || pdfB64 || opts.pdfText) && !deepseekKey && !openaiKey) {
    return res.status(200).json({ reply: "Document or image received. Set DEEPSEEK_API_KEY or OPENAI_API_KEY in Vercel (Project → Settings → Environment Variables) to get answers from PDFs and images." });
  }

  if (imageB64 && (deepseekKey || openaiKey)) {
    if (deepseekKey) {
      try {
        const reply = await fetchDeepSeekWithImage(context, q, imageB64, deepseekKey, hist);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("DeepSeek vision:", e?.message); }
    }
    if (openaiKey) {
      try {
        const reply = await fetchOpenAIVision(context, q, imageB64, openaiKey, hist);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("OpenAI vision:", e?.message); }
    }
    return res.status(200).json({ reply: "Image analysis needs DEEPSEEK_API_KEY or OPENAI_API_KEY in Vercel." });
  }

  if (context !== "No search results.") {
    if (deepseekKey) {
      try {
        const reply = await fetchDeepSeek(context, q, deepseekKey, hist);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("DeepSeek:", e?.message); }
    }
    if (openaiKey) {
      try {
        const reply = await fetchOpenAI(context, q, openaiKey, hist);
        return res.status(200).json({ reply });
      } catch (e) { console.warn("OpenAI:", e?.message); }
    }
  }

  return res.status(200).json({ reply: buildFallbackReply(opts) });
}
