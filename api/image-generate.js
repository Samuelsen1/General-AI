const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  try {
    const body = req.body || {};
    const prompt = (body.prompt || "").trim();
    const size = body.size || "1024x1024";
    const n = body.n || 1;

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n,
        size,
      }),
    });

    if (!resp.ok) {
      let err;
      try {
        err = await resp.json();
      } catch (_) {
        err = {};
      }
      return res
        .status(resp.status)
        .json({ error: err.error?.message || "Image generation failed" });
    }

    const data = await resp.json();
    const images = (data.data || []).map((img, idx) => ({
      index: idx,
      url: img.url,
      b64_json: img.b64_json || null,
    }));

    if (!images.length) {
      return res
        .status(200)
        .json({ success: false, error: "No image returned from provider" });
    }

    return res.status(200).json({
      success: true,
      images,
    });
  } catch (e) {
    console.error("image-generate error:", e);
    return res
      .status(500)
      .json({ error: "Internal server error", message: e.message });
  }
};

