/**
 * Pixazo text-to-video / image-to-video (LTX-2).
 * Set PIXAZO_API_KEY in env.
 */
const PIXAZO_BASE = "https://gateway.pixazo.ai";
const GENERATE_ENDPOINT = `${PIXAZO_BASE}/lightricks/v1/ltx/generate`;
const PREDICTION_ENDPOINT = `${PIXAZO_BASE}/lightricks/v1/ltx/prediction`;

function getHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Ocp-Apim-Subscription-Key": apiKey || "",
  };
}

async function pollPrediction(predictionId, apiKey, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(PREDICTION_ENDPOINT, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({ prediction_id: predictionId }),
    });
    const data = await res.json().catch(() => ({}));
    const status = (data.status || "").toLowerCase();
    if (status === "completed" || status === "succeeded") {
      const url = data.output?.video_url || data.video_url || data.output?.url || data.url;
      if (url) return url;
      const video = data.output?.video || data.video;
      if (typeof video === "string" && (video.startsWith("http") || video.startsWith("data:"))) return video;
    }
    if (status === "failed" || data.error) {
      throw new Error(data.error || data.message || "Video generation failed");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Video generation timed out");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.PIXAZO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, error: "PIXAZO_API_KEY not configured" });
  }

  try {
    const body = req.body || {};
    const prompt = (body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const payload = {
      prompt,
      duration: Math.min(20, Math.max(6, parseInt(body.duration, 10) || 6)),
      resolution: body.resolution || "1080p",
      generate_audio: !!body.generate_audio,
    };
    if (body.image && typeof body.image === "string") {
      payload.image = body.image;
    }

    const genRes = await fetch(GENERATE_ENDPOINT, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    const genData = await genRes.json().catch(() => ({}));
    const predictionId = genData.id || genData.prediction_id;
    if (!predictionId) {
      const errMsg = genData.error || genData.message || (genRes.ok ? "No job id returned" : `HTTP ${genRes.status}`);
      return res.status(genRes.ok ? 200 : genRes.status).json({ success: false, error: errMsg });
    }

    const videoUrl = await pollPrediction(predictionId, apiKey);
    return res.status(200).json({
      success: true,
      videoUrl,
      id: predictionId,
    });
  } catch (e) {
    console.error("pixazo-video error:", e);
    return res.status(500).json({ success: false, error: e.message || "Internal server error" });
  }
};
