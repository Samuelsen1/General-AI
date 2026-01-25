/** GET /api/status — which integrations are configured (no secrets). */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const google = !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
  const serper = !!process.env.SERPER_API_KEY;
  const brave = !!process.env.BRAVE_API_KEY;
  const tavily = !!process.env.TAVILY_API_KEY;
  const web = google ? "google" : serper ? "serper" : brave ? "brave" : tavily ? "tavily" : null;

  const deepseek = !!process.env.DEEPSEEK_API_KEY;
  const openai = !!process.env.OPENAI_API_KEY;
  const llm = deepseek ? "deepseek" : openai ? "openai" : null;

  res.status(200).json({
    wikipedia: true,
    weather: true,
    dictionary: true,
    web,
    news: !!process.env.NEWS_API_KEY,
    deepseek,
    openai,
    llm,
  });
};
