/**
 * POST /api/generate/audio – text-to-speech via AIMLAPI (stub; extend when TTS endpoint is fixed).
 * Body: { prompt: string }. Returns { reply, audioUrl } or { error }.
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const prompt = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "prompt required", reply: "Enter the text you want to turn into speech." });
  }

  const key = process.env.AIMLAPI;
  if (!key || !key.trim()) {
    return res.status(200).json({ reply: "Audio generation is not configured. Add AIMLAPI in Vercel.", audioUrl: null });
  }

  // AIMLAPI TTS endpoint varies by provider; placeholder until integrated.
  return res.status(200).json({
    reply: "Audio generation is coming soon. Use the chat for now and we’ll add text-to-speech next.",
    audioUrl: null,
  });
};
