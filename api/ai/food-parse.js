/* ═══ POST /api/ai/food-parse ═══
   Body: { description: "chicken caesar salad no dressing" }
   Returns: { ok, name, protein_g, fat_g, carbs_g, confidence, notes }

   Quick natural-language → macros parser. Gemini Flash is fast enough that this
   feels instant in the Add Meal modal. The user gets a draft, can adjust before
   saving. Confidence flag tells the UI how trustworthy the estimate is.

   Cost: ~$0.0001/call with gemini-flash-latest. Negligible.
*/

const MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a nutrition estimator. Given a brief food description, return a JSON object with macronutrient estimates.

Rules:
- Output JSON ONLY. No prose, no markdown, no code fences.
- Schema: { "name": string, "protein_g": number, "fat_g": number, "carbs_g": number, "confidence": "high"|"medium"|"low", "notes": string }
- "name" should be a clean, capitalized version of the input (e.g. "chicken caesar salad" → "Chicken Caesar Salad")
- "protein_g", "fat_g", "carbs_g" are integers in grams. Round to nearest whole gram.
- "confidence": high = standard portions of well-defined foods; medium = ambiguous portion size or restaurant variation; low = vague description ("some pasta")
- "notes" is a brief assumption string under 80 characters (e.g. "Assumes 150g chicken breast, 2 cups romaine, parmesan"). If trivial, return "".
- If the input is gibberish or non-food, return zeros and confidence "low" with note "Couldn't parse as food."
- Common standard portions if unspecified: 1 egg, 1 slice bread, 1 scoop protein, 1 cup rice, 1 medium banana, 1 chicken breast (~150g), 1 protein bar.
- Do NOT include micronutrients, sodium, fiber, or anything outside the schema.`;

async function callGemini(description, apiKey) {
  const r = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-goog-api-key": apiKey},
    body: JSON.stringify({
      systemInstruction: {parts: [{text: SYSTEM_PROMPT}]},
      contents: [{parts: [{text: description}]}],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 800,
        thinkingConfig: {thinkingBudget: 0},
        responseMimeType: "application/json",
      },
      safetySettings: [
        {category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH"},
        {category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH"},
        {category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH"},
        {category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH"},
      ],
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Gemini ${r.status}: ${body.slice(0, 300)}`);
  }
  const json = await r.json();
  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

function sanitize(raw) {
  /* Strip markdown fences if Gemini ignored the json mime type and wrapped in ```json */
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) { throw new Error("Couldn't parse Gemini output as JSON"); }

  /* Coerce + clamp */
  const out = {
    name: String(parsed.name || "").slice(0, 80) || "Unnamed meal",
    protein_g: Math.max(0, Math.min(999, Math.round(+parsed.protein_g || 0))),
    fat_g: Math.max(0, Math.min(999, Math.round(+parsed.fat_g || 0))),
    carbs_g: Math.max(0, Math.min(999, Math.round(+parsed.carbs_g || 0))),
    confidence: ["high","medium","low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    notes: String(parsed.notes || "").slice(0, 120),
  };
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ok: false, error: "method"});

  const {description} = req.body || {};
  if (!description || typeof description !== "string" || description.trim().length < 2) {
    return res.status(400).json({ok: false, error: "description required"});
  }
  if (description.length > 500) {
    return res.status(400).json({ok: false, error: "description too long"});
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ok: false, error: "no_api_key"});

  try {
    const raw = await callGemini(description.trim(), apiKey);
    const parsed = sanitize(raw);
    return res.status(200).json({ok: true, ...parsed, model: MODEL});
  } catch (e) {
    console.error("[ai/food-parse] failed", e);
    return res.status(500).json({ok: false, error: String(e.message || e)});
  }
}
