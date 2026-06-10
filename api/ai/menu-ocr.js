/* ═══ POST /api/ai/menu-ocr ═══
   Body: { image: base64_string, media_type: "image/jpeg" }
   Returns: { ok, days: [{day, meals: [{slot, name}]}] }
   Env vars required: ANTHROPIC_API_KEY
*/

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "no_api_key", message: "ANTHROPIC_API_KEY not configured in Vercel." });

  const { image, media_type } = req.body || {};
  if (!image) return res.status(400).json({ error: "no_image", message: "No image provided" });

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image } },
            { type: "text", text: `Extract the weekly meal plan from this menu image. Return ONLY valid JSON with no other text: {"days":[{"day":"Monday","meals":[{"slot":"Breakfast","name":"Meal name here"},{"slot":"Lunch","name":"Meal name"},{"slot":"Dinner","name":"Meal name"},{"slot":"Snack","name":"Snack name"}]}]} Include all days visible. Use exact meal names as printed. If a slot is not visible, omit it.` }
          ]
        }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: "api_error", message: data?.error?.message || "Anthropic API error" });

    const text = (data.content || []).map(c => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ ok: true, ...parsed });
  } catch (err) {
    return res.status(500).json({ error: "parse_error", message: err.message });
  }
}
