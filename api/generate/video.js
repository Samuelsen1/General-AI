/**
 * POST /api/generate/video – video generation via AIMLAPI (stub; extend when video API is integrated).
 * Body: { prompt: string }. Returns { reply, videoUrl } or { error }.
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const prompt = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "prompt required", reply: "Describe the video you want to generate." });
  }

  const key = process.env.AIMLAPI;
  if (!key || !key.trim()) {
    return res.status(200).json({ reply: "Video generation is not configured. Add AIMLAPI in Vercel.", videoUrl: null });
  }

  return res.status(200).json({
    reply: "Video generation is coming soon. Use the chat or generate an image for now.",
    videoUrl: null,
  });
};
