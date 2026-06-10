/* ═══ POST /api/ai/analysis ═══
   Body: { macros, scans, whoop, peptides, pepCorr, whoopBaseline, targets, tdee, profile }
   Effect: Calls Gemini Flash with all data streams, returns 2-4 connected actionable insights.
   Env vars required: GEMINI_API_KEY
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

  const { macros, scans, whoop, peptides, pepCorr, whoopBaseline, targets, tdee, profile } = req.body || {};

  const prompt = `You are a body recomposition coach analyzing data for a ${profile?.gender || "female"}, ${profile?.height || 152}cm, targeting ${profile?.goalBf || 25}% body fat. Current: ${scans?.[scans.length-1]?.fatPct || "unknown"}% BF, ${scans?.[scans.length-1]?.weight || "unknown"}kg. TDEE ~${tdee || 2042} kcal. Targets: protein ${targets?.protein || 150}g, calories ${targets?.cal || 1440}.

DATA:
Macros (last 7d): ${JSON.stringify(macros || [])}
InBody scans (last 3): ${JSON.stringify(scans || [])}
Whoop (last 10d): ${JSON.stringify(whoop || [])}
Active peptides: ${JSON.stringify(peptides || [])}
Peptide → next-day Whoop correlations: ${JSON.stringify(pepCorr || {})}
Whoop baseline averages: ${JSON.stringify(whoopBaseline || {})}

RULES:
1. Return ONLY a valid JSON array, no other text, no markdown fences, no explanation.
2. Each item: {"severity":"critical"|"warning"|"positive","title":"short title max 6 words","body":"2-3 sentences connecting multiple data streams. Be specific with numbers. Give ONE clear action.","tags":["macro","body","peptide","whoop"]}
3. Maximum 4 insights, minimum 2. Rank by impact on the ${profile?.goalBf || 25}% body fat goal.
4. CONNECT data streams — don't just restate one metric. Link deficit+protein+muscle loss, or peptide+recovery+RHR.
5. For peptide correlations: compare each peptide's next-day Whoop metrics vs the baseline. Flag if recovery drops >8pts or RHR rises >2bpm. Mention sample size.
6. Never say "watch for fatigue" or other vague advice. Be direct: "reduce deficit to X" or "add Y grams protein via Z."
7. If deficit exceeds 35%, flag it as critical with specific calorie recommendation.
8. If muscle/lean mass is declining across scans, flag it as critical and connect to protein + deficit.
9. Use only tags relevant to each insight from: macro, body, peptide, whoop.`;

  try {
    const r = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 4000,
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
    const insights = JSON.parse(clean);

    return res.status(200).json({ ok: true, insights, model: "gemini-flash" });
  } catch (err) {
    return res.status(500).json({ error: "parse_error", message: err.message });
  }
}
