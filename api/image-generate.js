// Image generation: local Stable Diffusion (SD_API_URL)
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

  // Image generation requires local SD setup
  return res.status(200).json({ 
    success: false, 
    error: "Image generation requires local Stable Diffusion setup (SD_API_URL)." 
  });
};
