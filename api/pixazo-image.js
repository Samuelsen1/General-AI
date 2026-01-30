/**
 * Pixazo text-to-image (Flux Schnell Turbo).
 * Set PIXAZO_API_KEY in env. Optional: PIXAZO_SECRET_KEY for X-Secret-Key.
 */
const PIXAZO_BASE = "https://gateway.pixazo.ai";
const IMAGE_ENDPOINT = `${PIXAZO_BASE}/flux-1-schnell/v1/getDataBatch`;
const CHECK_STATUS_ENDPOINT = `${PIXAZO_BASE}/flux-1-schnell/v1/checkStatus`;

function getHeaders(apiKey, secretKey) {
  const h = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Ocp-Apim-Subscription-Key": apiKey || "",
  };
  if (secretKey) h["X-Secret-Key"] = secretKey;
  return h;
}

async function pollCheckStatus(requestId, apiKey, secretKey, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(CHECK_STATUS_ENDPOINT, {
      method: "POST",
      headers: getHeaders(apiKey, secretKey),
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.status === "completed" || data.success === true) {
      const images = data.images || data.output?.images || data.data?.images || [];
      const list = Array.isArray(images) ? images : [];
      return list.map((b64) => (typeof b64 === "string" ? `data:image/png;base64,${b64}` : null)).filter(Boolean);
    }
    if (data.status === "failed" || data.error) {
      throw new Error(data.error || data.message || "Image generation failed");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Image generation timed out");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.PIXAZO_API_KEY;
  const secretKey = process.env.PIXAZO_SECRET_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, error: "PIXAZO_API_KEY not configured" });
  }

  try {
    const body = req.body || {};
    const prompt = (body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const size = body.size || "1024x1024";
    let width = 1024, height = 1024;
    const [wStr, hStr] = String(size).split("x");
    const wNum = parseInt(wStr, 10), hNum = parseInt(hStr, 10);
    if (Number.isFinite(wNum) && Number.isFinite(hNum)) {
      width = Math.min(1920, Math.max(512, wNum));
      height = Math.min(1920, Math.max(512, hNum));
    }

    const payload = {
      prompt,
      num_steps: body.num_steps ?? 4,
      seed: body.seed ?? Math.floor(Math.random() * 2147483647),
      width,
      height,
    };

    const createRes = await fetch(IMAGE_ENDPOINT, {
      method: "POST",
      headers: getHeaders(apiKey, secretKey),
      body: JSON.stringify(payload),
    });

    const createData = await createRes.json().catch(() => ({}));

    if (createData.requestId && (createData.status === "queued" || createRes.status === 202)) {
      const dataUrls = await pollCheckStatus(createData.requestId, apiKey, secretKey);
      if (dataUrls.length === 0) {
        return res.status(200).json({ success: false, error: "No image returned" });
      }
      return res.status(200).json({
        success: true,
        images: dataUrls.map((dataUrl, index) => ({ index, dataUrl })),
      });
    }

    if (createData.images && Array.isArray(createData.images) && createData.images.length > 0) {
      const images = createData.images.map((b64, idx) => ({
        index: idx,
        dataUrl: typeof b64 === "string" ? `data:image/png;base64,${b64}` : null,
      })).filter((i) => i.dataUrl);
      if (images.length) {
        return res.status(200).json({ success: true, images });
      }
    }

    const errMsg = createData.error || createData.message || (createRes.ok ? "No image in response" : `HTTP ${createRes.status}`);
    return res.status(createRes.ok ? 200 : createRes.status).json({ success: false, error: errMsg });
  } catch (e) {
    console.error("pixazo-image error:", e);
    return res.status(500).json({ success: false, error: e.message || "Internal server error" });
  }
};
