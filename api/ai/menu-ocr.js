/* ═══ POST /api/ai/menu-ocr ═══
   Body: { image: base64_string, media_type: "image/jpeg" }
   Returns: { ok, days: [{day, meals: [{slot, name}]}] }
   Env vars required: GEMINI_API_KEY
   Uses Gemini Flash vision to parse Smartfitchen weekly menu images.
*/

const MODEL = "gemini-2.5-flash-preview-05-20";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "no_api_key", message: "GEMINI_API_KEY not configured in Vercel." });

  const { image, media_type } = req.body || {};
  if (!image) return res.status(400).json({ error: "no_image", message: "No image provided" });

  const prompt = `Extract the weekly meal plan from this menu image. Return ONLY valid JSON with no other text, no markdown fences: {"days":[{"day":"Monday","meals":[{"slot":"Breakfast","name":"Meal name here"},{"slot":"Lunch","name":"Meal name"},{"slot":"Dinner","name":"Meal name"},{"slot":"Snack","name":"Snack name"}]}]} Include all days visible. Use exact meal names as printed. If a slot is not visible, omit it.`;

  try {
    const r = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: media_type || "image/jpeg", data: image } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
          thinkingConfig: { thinkingBudget: 0 },
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      return res.status(502).json({ error: "api_error", message: `Gemini ${r.status}: ${body.slice(0, 300)}` });
    }

    const json = await r.json();
    const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    if (!text) return res.status(502).json({ error: "empty_response", message: "Gemini returned no text." });

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ ok: true, ...parsed });
  } catch (err) {
    return res.status(500).json({ error: "parse_error", message: err.message });
  }
}
