/**
 * POST /api/generate/image – text-to-image via AIMLAPI.
 * Body: { prompt: string }. Returns { reply, imageUrl } or { error }.
 */
const AIMLAPI_IMAGE_URL = "https://api.aimlapi.com/v1/images/generations";
const DEFAULT_MODEL = "flux/schnell";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.AIMLAPI;
  if (!key || !key.trim()) {
    return res.status(200).json({ reply: "Image generation is not configured. Add AIMLAPI in Vercel environment variables.", imageUrl: null });
  }

  const prompt = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "prompt required", reply: "Describe the image you want to generate." });
  }

  const model = process.env.AIMLAPI_IMAGE_MODEL || DEFAULT_MODEL;
  try {
    const r = await fetch(AIMLAPI_IMAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, n: 1, response_format: "url" }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await r.json();
    if (!r.ok) {
      const errMsg = (data && data.error && data.error.message) ? data.error.message : `AIMLAPI ${r.status}`;
      return res.status(200).json({ reply: "Your request could not be completed. Try again later.", imageUrl: null });
    }
    const imageUrl = (data && data.data && data.data[0] && data.data[0].url) ? data.data[0].url : null;
    return res.status(200).json({
      reply: imageUrl ? "Here’s your generated image." : "Image generation did not return a result. Try again.",
      imageUrl,
    });
  } catch (e) {
    console.warn("AIMLAPI image:", e && e.message);
    return res.status(200).json({ reply: "Your request could not be completed. Try again later.", imageUrl: null });
  }
};
