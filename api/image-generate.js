// Local image generation using a Stable Diffusion–compatible server (e.g. AUTOMATIC1111)
// Configure the URL in SD_API_URL, default: http://127.0.0.1:7860
const SD_API_URL = process.env.SD_API_URL || "http://127.0.0.1:7860";

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

  try {
    const body = req.body || {};
    const prompt = (body.prompt || "").trim();
    const size = body.size || "1024x1024"; // mapped to width/height

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    // Map size string to width/height
    let width = 1024;
    let height = 1024;
    const [wStr, hStr] = String(size).split("x");
    const wNum = parseInt(wStr, 10);
    const hNum = parseInt(hStr, 10);
    if (Number.isFinite(wNum) && Number.isFinite(hNum)) {
      width = wNum;
      height = hNum;
    }

    // Call local Stable Diffusion txt2img API (AUTOMATIC1111 style)
    const resp = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        steps: body.steps || 25,
        cfg_scale: body.cfg_scale || 7,
        sampler_name: body.sampler_name || "Euler a",
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
    const imgList = Array.isArray(data.images) ? data.images : [];
    const images = imgList.map((b64, idx) => ({
      index: idx,
      // Frontend can render this directly as <img src="data:image/png;base64,..." />
      dataUrl: `data:image/png;base64,${b64}`,
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

