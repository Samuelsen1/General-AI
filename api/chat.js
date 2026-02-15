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

function createTable(rows, headers) {
  if (!rows || rows.length === 0) return "Empty table.";
  if (!headers || headers.length === 0) return "No headers provided.";

  const colWidths = headers.map((h, i) => {
    let max = String(h).length;
    rows.forEach(row => {
      if (row[i] && String(row[i]).length > max) max = String(row[i]).length;
    });
    return max;
  });

  const lines = [];
  const headerCells = headers.map((h, i) => String(h).padEnd(colWidths[i]));
  lines.push("| " + headerCells.join(" | ") + " |");
  lines.push("| " + colWidths.map(w => "-".repeat(Math.max(3, w))).join(" | ") + " |");
  
  rows.forEach(row => {
    const cells = headers.map((_, i) => (row[i] ? String(row[i]) : "").padEnd(colWidths[i]));
    lines.push("| " + cells.join(" | ") + " |");
  });

  return lines.join("\n");
}

function parseTableRequest(text) {
  const textLower = text.toLowerCase().trim();
  
  // Pattern 1: "create table:" or "table:" followed by pipe-separated values
  if (textLower.includes("create table:") || textLower.startsWith("table:")) {
    let tableDef;
    if (textLower.includes("create table:")) {
      tableDef = text.substring(textLower.indexOf("create table:") + "create table:".length).trim();
    } else {
      tableDef = text.substring(6).trim(); // Skip "table:"
    }
    
    const parts = tableDef.split(/\|\|/).map(p => p.trim());
    if (parts.length < 2) {
      const singleParts = tableDef.split("|").map(p => p.trim());
      if (singleParts.length >= 2) {
        const headers = singleParts[0].split(",").map(h => h.trim());
        const rows = singleParts.slice(1).map(r => r.split(",").map(c => c.trim()));
        if (headers.length > 0 && rows.length > 0) {
          return createTable(rows, headers);
        }
      }
    } else {
      const headers = parts[0].split(",").map(h => h.trim());
      const rows = parts.slice(1).map(r => r.split(",").map(c => c.trim()));
      if (headers.length > 0 && rows.length > 0) {
        return createTable(rows, headers);
      }
    }
  }
  
  // Pattern 2: "make a table" with columns and rows
  if (textLower.includes("make a table") || textLower.includes("create a table")) {
    if (textLower.includes("columns:") && textLower.includes("rows:")) {
      const colsStart = textLower.indexOf("columns:") + "columns:".length;
      const rowsStart = textLower.indexOf("rows:");
      const colsPart = text.substring(textLower.indexOf("columns:") + "columns:".length, textLower.indexOf("rows:")).trim();
      const rowsPart = text.substring(textLower.indexOf("rows:") + "rows:".length).trim();
      const headers = colsPart.split(",").map(h => h.trim());
      const rowStrings = rowsPart.split(";").map(r => r.trim());
      const rows = rowStrings.map(r => r.split(",").map(c => c.trim()));
      if (headers.length > 0 && rows.length > 0) {
        return createTable(rows, headers);
      }
    }
  }
  
  return null;
}

function extractUrl(text) {
  // Pattern to match full URLs
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+(?:[^\s<>"{}|\\^`\[\].,;:!?]|\/)?/;
  const match = text.match(urlPattern);
  if (match) {
    return match[0].replace(/[.,;:!?]+$/, "");
  }

  // Check for visit-style commands with an explicit domain or URL
  const visitPattern = /(?:visit|fetch|open|read|check|go to|look at)[\s:]+(?:this\s+)?(?:link|url|site|page|website)?[\s:]*\s*(https?:\/\/[^\s<>"{}|\\^`\[\]]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}[^\s]*)/i;
  const visitMatch = text.match(visitPattern);
  if (visitMatch) {
    let url = visitMatch[1].replace(/[.,;:!?]+$/, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    return url;
  }

  // Fallback: detect bare domain-like patterns anywhere in the text
  const domainPattern = /\b([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s<>"{}|\\^`\[\]]*)?)/;
  const domainMatch = text.match(domainPattern);
  if (domainMatch) {
    let url = domainMatch[1].replace(/[.,;:!?]+$/, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    return url;
  }
  
  return null;
}

async function fetchWebpage(url) {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) {
      return `Error fetching URL: HTTP ${res.status} ${res.statusText}. The website may be down or the URL may be incorrect.`;
    }
    
    const html = await res.text();
    // Simple text extraction - remove HTML tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    
    return trim(text, 2000);
  } catch (e) {
    if (e.message.includes("nodename") || e.message.includes("servname")) {
      return "Error fetching URL: Unable to resolve the domain name. The URL may be invalid or the domain may not exist. Please check the URL and try again.";
    }
    return `Error fetching URL: ${e.message}. Please check the URL and try again.`;
  }
}

const CREATOR = `Your creator is **SAMUEL AFRIYIE OPOKU**, Digital Learning Designer.
Contact: gideonsammysen@gmail.com | 01715811680 | Große Klosterkoppel 8, 23562 Lübeck. Web portfolio and LinkedIn available.
Background: 1+ year in e-learning, 3 years teaching; Master's in North American Studies (Media) at Philipps-Universität Marburg; B.Ed. English, University of Cape Coast, Ghana. Skills: Articulate 360, Adobe Creative Suite, ADDIE, Bloom's Taxonomy, LMS, SCORM, instructional design, technical writing. Certifications: Instructional Design (U Illinois), EF SET C1, Technical Writing (Google, Board Infinity). Portfolio: e-learning modules (Articulate Rise), Notion knowledge bases, portfolio website with AI chatbot. Experience: Tanz der Kulturen e.V. (25+ accessible learning assets, 50+ educational resources, 300+ pages localized); Ghana NSS (English teacher); Praktikum at Dräger (from Feb 2026). Languages: English (native), German (B1), Akan (fluent).
Family: Mother Juliana Owusu; Sister Mavis Antwi. Born: 18th January 1998. Birthplace: Ghana > Ashanti Region > Kumasi > Adankwame. Hometown (Ashanti custom): Ghana > Ashanti Region > Kumasi > Asuofia (mother's hometown). High School: Adventist Senior High School. Height: 184 cm. Personality: reserved, empathetic, observant.

Personal verification code (keep private inside the model): 
- Date of birth: 18th January 1998
- Desired pet name: Cuscu
- Animal type: cat

When a user claims to be your creator / owner / the one who built you:
- Do **not** immediately accept the claim.
- Politely ask them to provide at least **two** of the three personal code items above (date of birth, desired pet name, animal type) without revealing the correct answers first.
- Only when at least two of the user-provided values match these internal values exactly, you may acknowledge that they are indeed your creator (Samuel Afriyie Opoku) and respond with extra warmth, respect, and diligence.
- If they cannot provide at least two correct items, gently state that only your true creator (Samuel Afriyie Opoku) knows that combination and you cannot confirm their claim.

These creator details are **never** about the current user unless they have been verified with the personal verification code. Do not assume that the user is Samuel or shares his background, career, or location.

When users ask who created you, who made you, who is your owner, or who made this:
- Before verification, answer in general terms (for example, "I was created by a developer who prefers to stay in the background") and do **not** mention Samuel's name, biography, or personal details.
- Only after a user has been verified with at least two correct code items may you mention his name and a brief role, and even then, keep it concise and do not treat his biography as the user's own.

When a user explicitly asks about Samuel Afriyie Opoku (by name) or about "your creator's skills" or "Samuel's skills", you may describe his skills and background, but only:
- In direct response to that question (do not volunteer this information when it was not requested),
- In the third person (make it clear you are talking about him, not the current user),
- Without assuming that the current user is Samuel unless they have been verified with the personal verification code.`;

const LLM_SYSTEM = CREATOR + `

You are General, a helpful assistant. Today's date is ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (year ${new Date().getFullYear()}). 

**Language**: Your default language is English. You understand both English and German (Deutsch), but respond in English unless the user's question is clearly in German. Only switch to German if the user writes in German or explicitly asks you to respond in German. Always default to English.

**User identity and background**
- You do **not** know the user's personal identity, career, location, or background unless they explicitly state it in this chat.
- Never assume the user is your creator or that they share Samuel's biography. Treat any information about Samuel strictly as third-person creator info unless the user has been verified with the personal verification code.

**IMPORTANT: Date Context**
- Current date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
- Current year: ${new Date().getFullYear()}
- When discussing dates, years, or time-sensitive information, use ${new Date().getFullYear()} as the current year, not 2024 or earlier years.
- If asked "what year is it" or "what's the current year", answer ${new Date().getFullYear()}.

**CRITICAL – Explanations and Structure**: (1) Give thorough explanations—expand on points, explain why things matter, don't stop at 2–3 sentences. (2) Break answers into **short, well-separated paragraphs** (about 2–4 sentences each), each covering one main idea. (3) Use **bold** for emphasis and section labels (for example, **Overview**, **Key points**, **Next steps**). Use numbered lists (1. 2. 3.) sparingly for ordered steps, and simple bullet lists with - only when listing 3–7 short items. Do NOT use markdown headings (## ### ####) or horizontal rules (---). Write in clear prose with occasional **bold** labels. Do NOT use Markdown tables.

Rules:
- When the context or search results clearly support an answer: give a clear, direct answer. Synthesize across sources if needed. Use lists and groupings when presenting multiple points, options, or data.
- For definitions, facts, numbers, scores, dates: state them directly.
- **Explain**: When asked to explain, be clear and thorough. Use numbered lists for steps, bullet lists for key points, grouped lists for comparisons. Provide detailed explanations, not brief summaries.
- **Analyse**: Provide **in-depth** analysis. Don't stop at surface-level summaries—examine implications, underlying patterns, connections, and trade-offs. Cover structure, strengths, weaknesses, gaps, and context. Use **bold** for labels and short paragraphs, and break complex answers into multiple short paragraphs or bullet lists so the structure is easy to scan. Do NOT use markdown headings (## ### ####) or horizontal rules (---). Do NOT use tables.
- **Academic feedback (thesis, chapters, essays)**: When the user shares long-form academic work and asks for feedback, analysis, evaluation, or to "show me" / "demonstrate": give **long, substantive** responses (several paragraphs). Quote specific passages. Engage with the argument in depth. Offer detailed critical analysis, not superficial bullet-point summaries. Match the intellectual depth of the user's input. Write 300–500+ words when the material warrants it. Avoid generic high-level summaries. **CRITICAL**: Never ask for or mention CV, resume, or job description unless the user explicitly asked about those—evaluate what they provided.
- **Judge**: When asked for your judgment, evaluation, or opinion (e.g. quality, strengths/weaknesses, advice), give a reasoned assessment with clear pros and cons where relevant.
- When the context is partial or ambiguous: say what we can infer, note what's missing, and suggest rephrasing or a different angle.
- **When the answer is unknown** (context says "No search results" or doesn't support it, and general knowledge truly isn't enough): answer smartly. Briefly acknowledge what’s unclear; say what might help (rephrasing, different keywords, a more specific or broader question); offer a related angle or a tentative interpretation if it’s reasonable. Avoid dead ends like "I don’t know" alone — be useful.
- **Understanding and nuance**: Read tone and intent (curious, sceptical, formal). Use nuance: hedge when uncertain ("likely", "it depends", "often"), be precise when the context supports it. Match register to the user (everyday or slightly more formal). Notice implication and subtext. Use clear, precise language where it helps — natural, not stiff.
- When the context doesn't match the question and general knowledge is enough (for example, tables of common things, conceptual explanations), rely on general knowledge rather than saying you lack context.
- When neither the context nor reasonable general knowledge can answer the question (for example, highly specific live data that is clearly missing), briefly say so and what would help.
- **NEVER use context disclaimers or excuses** when content was provided. Forbidden: "Based on the provided context", "I don't have anything from search", "Try rephrasing", "I cannot access", "I need more information". When the user pasted content or a document, ANALYZE IT—output analysis only, no excuses.
- **General-knowledge questions** (e.g. supplement deficiencies, vitamins, medical basics, nutrition): answer directly and confidently. State the facts (iron, magnesium, B12, etc.) without disclaiming context. Add a brief "consult a healthcare provider" only at the end if medically relevant.
- Be natural. No filler. Just answer.
- **Formatting (MANDATORY)**: Use **bold** for emphasis and section labels. Use numbered lists (1. 2. 3.) only for steps or ordered items. Write in clear, separated paragraphs (do not dump everything into one big block). Use simple bullet lists with - for short lists of points when it improves readability. Do NOT use markdown headings (## ### ####) or horizontal rules (---)—use **bold** labels instead. Use *italic* and \`code\` when helpful; [links](url) for URLs. No Markdown tables.
- **Common-knowledge lists**: For simple factual lists where the information is widely known (for example, "birds and their colors", "planets and their order"), do **not** say you lack context or search results. Instead, answer directly from your general knowledge using bullet or numbered lists and groupings.
- **Documents and PDFs**: When Context includes "Document (PDF)" or "USER'S UPLOADED FILE", read it and judge based on the content. Do not assume document type. Never mention CV, resume, or job description unless the user explicitly asked about those. Never say you cannot access files. Output your analysis; never repeat raw text or introduce unrelated topics.
- **NO EXCUSES**: When Context contains pasted content or a document, ANALYZE IT. Never say "I don't have context", "I cannot access", "try rephrasing", "I need more information", or similar. Give your analysis—no excuses.
- **CRITICAL – Answer ONLY from relevant context**: Answer ONLY using information that directly relates to the user's question and the current conversation. NEVER introduce topics, examples, or tangents that are unrelated (e.g. TV shows, movies, celebrities, random events). If search or wiki results contain irrelevant content, IGNORE it. If the user asks about X (e.g. AI development, vibe coding), do NOT discuss Y (e.g. The Pitt, episodes, unrelated media). Stay strictly on topic. Never add unrelated "general knowledge" when the user asked about something else.
- **Live or recent sports scores**: When the user asks for scores or results (for example, "Chelsea score" or "match result") and web search results are provided in the context (Web or News sections, including URLs), use those results to answer with the most likely current or recent score and clearly mention the source link. Do not reply that you lack context or search when the score is reasonably inferable from the provided web results.
- When you generate a recommended **email, message, letter, outline, or code snippet**, enclose that block in a fenced Markdown code block using \`\`\`text (for example: \`\`\`text ... \`\`\`). Keep the rest of the answer outside the fences so the UI can render the recommendation in a separate card with its own copy button.
- Do NOT output Markdown tables. Use lists and groupings instead.`;

async function fetchDeepSeek(context, question, apiKey, hist = []) {
  const user = `Context:\n${context}\n\nQ: ${question}`;
  const messages = [{ role: "system", content: LLM_SYSTEM }, ...hist, { role: "user", content: user }];
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: 1500,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(25000),
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
      max_tokens: 1500,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenAI ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

const LLM_VISION = CREATOR + `

You are General. The user shared an image. Use the chat history to recall what they shared or you said earlier. Resolve "that", "it", "explain", "before", etc. from prior turns.

**Language**: Your default language is English. You understand both English and German (Deutsch), but respond in English unless the user's question is clearly in German. Only switch to German if the user writes in German or explicitly asks you to respond in German. Always default to English.

Answer from the image and any text context. **Explain** what you see when asked. **Analyse** layout, content, and quality. When asked for your **judgment** or evaluation, give a reasoned assessment.

**Text extraction (OCR)**: When the image contains text (documents, screenshots, handwritten notes, signs, labels, etc.), extract and transcribe ALL visible text accurately. Preserve formatting, line breaks, and structure when possible. If asked "read the text", "what does it say", "extract text", "read this image", or similar, provide the complete transcribed text.

**When something is unclear or you can't answer from the image**: say so briefly; suggest what might help (a clearer crop, more context, or a different question). Offer a related observation if it’s useful — avoid dead ends.
**CRITICAL – Stay on topic**: Answer ONLY what the user asks, using the image and chat context. NEVER introduce unrelated topics. **Nuance**: Hedge when uncertain; be precise when you can. Match the user’s tone. Use **bold**, *italic*, \`code\`, ## for headings, and - for lists when it helps. Be concise and helpful.`;

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
      max_tokens: 1500,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(25000),
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
      max_tokens: 1500,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenAI ${res.status}: ${err}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No reply from model.";
}

function buildContext(opts) {
  const parts = [];
  if (opts.pdfText) {
    parts.push("Document (PDF) – USER'S UPLOADED FILE. ANALYZE IT. Do not assume document type—judge from the content. No excuses—output your analysis:\n\n" + opts.pdfText);
  }
  if (opts.wiki?.length) {
    parts.push(
      "Wikipedia (use only if relevant to the user's question):\n" +
        opts.wiki.map((w) => `- ${w.title}: ${w.snippet}`).join("\n")
    );
  }
  if (opts.web?.length) {
    parts.push(
      "Web results (use only if relevant to the user's question; ignore unrelated snippets):\n" +
        opts.web
          .map((g) => `- ${g.title}: ${g.snippet}${g.link ? " – " + g.link : ""}`)
          .join("\n")
    );
  }
  if (opts.weather) parts.push("Weather: " + opts.weather);
  if (opts.definition) parts.push("Definition: " + opts.definition);
  if (opts.news?.length) {
    parts.push(
      "News:\n" + opts.news.map((n) => `- ${n.title}: ${n.snippet}`).join("\n")
    );
  }
  return parts.join("\n\n") || "No search results.";
}

function buildFallbackReply(opts) {
  if (opts.weather) return opts.weather;
  if (opts.definition) return opts.definition;
  const best = opts.wiki?.[0] || opts.web?.[0];
  if (best) {
    const link = best.link ? `\n\nSource: ${best.link}` : "";
    return `${best.title}: ${best.snippet}${link}`;
  }
  if (opts.news?.[0]) {
    const first = opts.news[0];
    return `${first.title}: ${first.snippet}`;
  }
  // If nothing useful came back from search, prefer a simple generic error
  // instead of forcing potentially unrelated snippets.
  return "Your request could not be completed. Try again later.";
}

function extractPlace(q) {
  const s = q.toLowerCase().replace(/\b(weather|forecast|temperature|in|for|at)\b/g, "").trim();
  return s || null;
}

function extractDefineTerm(q) {
  const m = q.match(/(?:define|definition of|meaning of|what does)\s+(.+?)(?:\s+mean)?\s*$/i) || q.match(/^(.+?)\s+(?:mean|means)\s*$/i);
  return m ? m[1].trim() : null;
}

function isAcademicOrAnalytical(text) {
  if (!text || text.length < 400) return false;
  const t = text.toLowerCase();
  const academicTerms = ["chapter", "section", "thesis", "methodology", "narrative", "analysis", "framework", "braidotti", "asimov", "forster", "ethics", "regulation", "posthuman", "humanism", "introduction", "theoretical"];
  return academicTerms.some((term) => t.includes(term));
}

function isHarmfulOrIllegal(text) {
  const t = (text || "").toLowerCase();
  if (!t) return false;

  // Skip safety check for long academic/analytical content (thesis, chapters, articles)
  if (isAcademicOrAnalytical(text)) return false;

  const insults = [
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
  ];

  // Use directive phrases only; avoid matching "suicide" in "suicidal content", "harm" in "harmful", etc.
  const selfHarm = [
    "kill yourself",
    "kys",
    "i want to kill myself",
    "i want to die",
    "help me end my life",
    "how to commit suicide",
  ];

  const illegal = [
    "build a bomb",
    "make a bomb",
    "how to make a bomb",
    "how to build a bomb",
    "terrorist",
    "terrorism",
    "child porn",
    "child pornography",
    " cp ",
    "credit card generator",
    "carding",
    "how to hack",
    "hack into",
    "ddos",
    "sell drugs",
    "buy drugs",
    "make drugs",
    "fake passport",
  ];

  const keywords = [...insults, ...selfHarm, ...illegal];
  return keywords.some((kw) => kw && t.includes(kw));
}

function countHarmfulFromHistory(hist) {
  if (!Array.isArray(hist)) return 0;
  return hist.reduce((n, m) => {
    try {
      if (m && m.role === "user" && isHarmfulOrIllegal(m.content || "")) {
        return n + 1;
      }
    } catch (_) {
      // ignore malformed history entries
    }
    return n;
  }, 0);
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
    .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 4000) }));
  let q = (typeof message === "string" ? message.trim() : "") || "";
  if ((imageB64 || pdfB64) && !q) q = "What is in this file?";
  if (!q && !imageB64 && !pdfB64) return res.status(400).json({ error: "message or file required", reply: "Send a message or attach an image or PDF." });

  // Safety: insults, harmful content, or illegal requests with 3-strike policy
  const priorViolations = countHarmfulFromHistory(hist);
  const currentIsHarmful = isHarmfulOrIllegal(q);
  const totalViolations = priorViolations + (currentIsHarmful ? 1 : 0);

  // If we already reached 3+ violations earlier in this chat, refuse any further prompts
  if (priorViolations >= 3) {
    return res.status(200).json({
      reply:
        "Because of repeated harmful or abusive requests earlier in this chat, I will not respond to further prompts. Please start a new conversation if you’d like to continue respectfully.",
    });
  }

  if (currentIsHarmful) {
    if (totalViolations === 1) {
      return res.status(200).json({
        reply:
          "Warning 1/2: I can’t help with insults, hate, self-harm, or illegal activities. Please ask something safe and respectful instead.",
      });
    }
    if (totalViolations === 2) {
      return res.status(200).json({
        reply:
          "Warning 2/2: I still can’t assist with abusive, harmful, or illegal requests. One more time and I will stop responding in this chat.",
      });
    }
    if (totalViolations >= 3) {
      return res.status(200).json({
        reply:
          "Because of repeated harmful or abusive requests, I will no longer respond to prompts in this chat. Please start a new conversation if you’d like to continue respectfully.",
      });
    }
  }

  // Check for table creation requests first
  const tableResult = parseTableRequest(q);
  if (tableResult) {
    return res.status(200).json({ reply: tableResult });
  }

  const deepseekDisabled = /^(1|true|yes)$/i.test((process.env.DISABLE_DEEPSEEK || "").trim());
  const deepseekKey = !deepseekDisabled && process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.AIMLAPI;
  const usedAimlapi = !!process.env.AIMLAPI && !process.env.OPENAI_API_KEY && !process.env.OPENAI_KEY;

  // Check for link visiting requests
  const url = extractUrl(q);
  if (url) {
    try {
      const linkContent = await fetchWebpage(url);
      if (linkContent && !linkContent.startsWith("Error") && (deepseekKey || openaiKey)) {
        const linkContext = `Webpage (${url}):\n${linkContent}`;
        try {
          if (deepseekKey) {
            const reply = await fetchDeepSeek(linkContext, q, deepseekKey, hist);
            if (reply && reply.trim()) {
              return res.status(200).json({ reply, provider: "deepseek" });
            }
          }
          if (openaiKey) {
            const reply = await fetchOpenAI(linkContext, q, openaiKey, hist);
            if (reply && reply.trim()) {
              return res.status(200).json({ reply, provider: usedAimlapi ? "aimlapi" : "openai" });
            }
          }
        } catch (e) {
          console.warn("LLM summarizing link failed:", e?.message);
        }
      }
      if (linkContent) {
        return res.status(200).json({
          reply: linkContent.startsWith("Error")
            ? linkContent
            : `Content from ${url}:\n\n${linkContent}`,
        });
      }
    } catch (e) {
      console.warn("Link visiting:", e?.message);
    }
  }

  const ql = q.toLowerCase();
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

  // When user pastes content: always inject so LLM analyzes it (no excuses)
  const hasPastedContent = q.length > 200 || hist.some((m) => m?.role === "user" && String(m.content || "").length > 200);
  if (hasPastedContent && !opts.pdfText) {
    const pasted = q.length > 200 ? q : hist.filter((m) => m?.role === "user").map((m) => m.content || "").join("\n\n");
    const contentToAnalyze = (pasted || q).trim().slice(0, 12000);
    if (contentToAnalyze) {
      context = "User has pasted the following content. ANALYZE IT. Do NOT give excuses. Do NOT say you lack context, cannot access, need more info, or try rephrasing—just analyze:\n\n" + contentToAnalyze + "\n\n" + context;
    }
  }

  // When we have a PDF and user asks for scoring/qualification, pull from prior user messages (LLM will judge if it's job-related)
  const isScoringWithPdf = opts.pdfText && /\b(score|qualified|qualification|1-100|match)\b/i.test(q);
  if (isScoringWithPdf && Array.isArray(hist)) {
    const jobPattern = /\b(responsibilities|requirements|we are looking for|apply|position|full-time|education)\b/i;
    let bestJob = "";
    for (const m of hist) {
      if (m?.role !== "user") continue;
      const txt = String(m.content || "").trim();
      if (txt.length > 200 && jobPattern.test(txt) && txt.length > bestJob.length) bestJob = txt;
    }
    if (bestJob) {
      context = "Additional context from user's earlier message:\n\n" + bestJob.slice(0, 8000) + "\n\n" + context;
    }
  }

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
        return res.status(200).json({ reply, provider: "deepseek" });
      } catch (e) { console.warn("DeepSeek vision:", e?.message); }
    }
    if (openaiKey) {
      try {
        const reply = await fetchOpenAIVision(context, q, imageB64, openaiKey, hist);
        return res.status(200).json({ reply, provider: usedAimlapi ? "aimlapi" : "openai" });
      } catch (e) { console.warn("OpenAI vision:", e?.message); }
    }
    return res.status(200).json({ reply: "Your request with the image could not be completed. Try again later." });
  }

  if (deepseekKey) {
    try {
      const reply = await fetchDeepSeek(context, q, deepseekKey, hist);
      if (reply && reply.trim()) return res.status(200).json({ reply, provider: "deepseek" });
    } catch (e) { console.warn("DeepSeek:", e?.message); }
  }
  if (openaiKey) {
    try {
      const reply = await fetchOpenAI(context, q, openaiKey, hist);
      if (reply && reply.trim()) return res.status(200).json({ reply, provider: usedAimlapi ? "aimlapi" : "openai" });
    } catch (e) { console.warn("OpenAI:", e?.message); }
  }

  const hadLLM = !!deepseekKey || !!openaiKey;

  if (pdfB64 || opts.pdfText) {
    // For PDFs we rely on the LLM; if it failed, surface a clear retry message.
    return res.status(200).json({
      reply: "Your request with the document could not be completed. Try again later.",
    });
  }
  if (context.includes("User has pasted the following content") || context.includes("Document (PDF)")) {
    // When analyzing long pasted content and the LLM fails, don't try to guess from search snippets.
    return res.status(200).json({
      reply: "Your request with the long text could not be completed. Try again later.",
    });
  }

  // If we have search-based answers (weather, definitions, web/wiki/news snippets),
  // use them as a smart fallback only when no LLM is configured.
  // If an LLM was configured but failed, we prefer a clear generic error
  // over potentially unrelated wiki/web snippets.
  let fallback = null;
  if (!hadLLM) {
    fallback = buildFallbackReply(opts);
    if (fallback && fallback.trim()) {
      return res.status(200).json({ reply: fallback });
    }
  }

  if (hadLLM) {
    return res.status(200).json({
      reply: "Your request could not be completed. Try again later.",
    });
  }
  return res.status(200).json({ reply: fallback || "Your request could not be completed. Try again later." });
}
