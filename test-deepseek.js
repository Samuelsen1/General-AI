#!/usr/bin/env node
/**
 * Quick test: DeepSeek API
 * Usage: DEEPSEEK_API_KEY=sk-xxx node test-deepseek.js
 *    or: node test-deepseek.js   (reads .env.local or .env)
 */

const fs = require("fs");
const path = require("path");

// Load .env.local or .env into process.env for this script
for (const f of [".env.local", ".env"]) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, "utf8");
    for (const line of s.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    break;
  }
}

const key = process.env.DEEPSEEK_API_KEY;

async function main() {
  if (!key) {
    console.error("DEEPSEEK_API_KEY not set. Set it in .env, .env.local, or:");
    console.error("  DEEPSEEK_API_KEY=sk-xxx node test-deepseek.js");
    process.exit(1);
  }

  console.log("Calling DeepSeek API (model: deepseek-chat)…");
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 20,
    }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }

  if (!res.ok) {
    console.error("DeepSeek API error:", res.status, text || res.statusText);
    process.exit(1);
  }
  const msg = data?.choices?.[0]?.message?.content?.trim();
  if (msg) {
    console.log("DeepSeek API works. Reply:", msg);
  } else {
    console.error("Unexpected response:", JSON.stringify(data || text, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Error:", e?.message || e);
  process.exit(1);
});
