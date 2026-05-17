/* ═══ POST /api/ai/weekly-summary ═══
   Body: { user_id }
   Effect:
     1. Gather last 7-14 days of data for user across all streams
     2. Build a structured prompt
     3. Call Gemini 2.5 Flash (free tier)
     4. Save result to ai_summaries
     5. Return { ok, summary_md, generated_at, error }

   Env vars required: GEMINI_API_KEY (free, no credit card — https://aistudio.google.com/apikey)

   Free tier: 10 RPM / 250 RPD / 250K TPM. Weekly use = ~4 calls/month. Plenty of headroom.
   Note: free tier may use prompts to improve Google's models. For personal health
   metrics this is acceptable; do not send proprietary corporate data through this endpoint.
*/

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdGlucGd3aHBqd29vaHBramduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTI4MzksImV4cCI6MjA5NDQ4ODgzOX0.XVrnWxg4MXOB9iBxkq9rP9T8XBsBjS8Ff85jC4MhLPc";

const MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const sbHdr = {apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json"};

/* Helper: ISO date n days ago in Manila TZ */
function manilaDateOffset(daysBack) {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

async function sbSelect(table, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${SB_URL}/${table}?${qs}`, {headers: sbHdr});
  if (!r.ok) {
    console.warn(`[ai/weekly] ${table} ${r.status}`);
    return [];
  }
  return r.json();
}

/* Gather all relevant data for the report.
   Strategy: pull last 14 days of streams (to allow week-over-week comparison),
   plus latest scans and active stack. Returns compact JSON object. */
async function gatherData(userId) {
  const today = manilaDateOffset(0);
  const d7   = manilaDateOffset(7);
  const d14  = manilaDateOffset(14);

  const [scans, peps, macros, wellness, whoop, stack, batches, meas] = await Promise.all([
    sbSelect("inbody_scans",     {user_id: `eq.${userId}`, select: "date,weight,fat_pct,fat_mass,lean_mass,visceral_fat", order: "date.desc", limit: "3"}),
    sbSelect("daily_peptides",   {user_id: `eq.${userId}`, date: `gte.${d14}`, select: "date,checks,side_effects", order: "date.desc"}),
    sbSelect("daily_macros",     {user_id: `eq.${userId}`, date: `gte.${d7}`,  select: "date,calories,protein_g,fat_g,carbs_g", order: "date.desc"}),
    sbSelect("daily_wellness",   {user_id: `eq.${userId}`, date: `gte.${d7}`,  select: "date,mood,energy,sleep_quality,notes", order: "date.desc"}),
    sbSelect("daily_whoop",      {user_id: `eq.${userId}`, date: `gte.${d7}`,  select: "date,recovery,sleep,strain,hrv_ms,rhr,sleep_hours", order: "date.desc"}),
    sbSelect("peptide_stack",    {user_id: `eq.${userId}`, enabled: "eq.true", select: "peptide_id,dose,schedule,time,status,total_weeks,start_date"}),
    sbSelect("peptide_batches",  {exhausted: "eq.false", select: "peptide_id,date_recon,mg_total,ml_bac,expiry_date,cost,currency,vendor"}),
    sbSelect("body_measurements",{user_id: `eq.${userId}`, select: "date,waist,hips,chest,thigh", order: "date.desc", limit: "3"}),
  ]);

  /* Compact peptide compliance: per-peptide, days-taken / days-this-week */
  const last7Peps = peps.filter(r => r.date >= d7);
  const compliance = {};
  for (const row of last7Peps) {
    for (const pep of Object.keys(row.checks || {})) {
      compliance[pep] = (compliance[pep] || 0) + 1;
    }
  }

  /* Macro averages */
  const macroAvg = macros.length ? {
    avg_cal: Math.round(macros.reduce((s,r) => s + (r.calories || 0), 0) / macros.length),
    avg_protein: Math.round(macros.reduce((s,r) => s + (r.protein_g || 0), 0) / macros.length),
    days_logged: macros.length,
  } : null;

  /* Wellness averages */
  const wellnessAvg = wellness.length ? {
    avg_mood: +(wellness.reduce((s,r) => s + (r.mood || 0), 0) / wellness.length).toFixed(1),
    avg_energy: +(wellness.reduce((s,r) => s + (r.energy || 0), 0) / wellness.length).toFixed(1),
    avg_sleep: +(wellness.reduce((s,r) => s + (r.sleep_quality || 0), 0) / wellness.length).toFixed(1),
    notes: wellness.filter(r => r.notes).map(r => ({date: r.date, note: r.notes})),
    daily: wellness.map(r => ({date: r.date, mood: r.mood, energy: r.energy, sleep: r.sleep_quality})),
  } : null;

  /* Whoop averages + daily */
  const whoopAvg = whoop.length ? {
    avg_recovery: Math.round(whoop.reduce((s,r) => s + (r.recovery || 0), 0) / whoop.length),
    avg_sleep: Math.round(whoop.reduce((s,r) => s + (r.sleep || 0), 0) / whoop.length),
    avg_strain: +(whoop.reduce((s,r) => s + (r.strain || 0), 0) / whoop.length).toFixed(1),
    avg_hrv: whoop.some(r => r.hrv_ms) ? +(whoop.filter(r => r.hrv_ms).reduce((s,r) => s + r.hrv_ms, 0) / whoop.filter(r => r.hrv_ms).length).toFixed(1) : null,
    avg_rhr: whoop.some(r => r.rhr) ? Math.round(whoop.filter(r => r.rhr).reduce((s,r) => s + r.rhr, 0) / whoop.filter(r => r.rhr).length) : null,
    daily: whoop.map(r => ({date: r.date, recovery: r.recovery, sleep: r.sleep, strain: r.strain, hrv: r.hrv_ms, rhr: r.rhr})),
  } : null;

  /* Active batches with expiry status */
  const today_ms = Date.now();
  const batchInfo = batches.map(b => {
    const days = b.expiry_date
      ? Math.round((new Date(b.expiry_date + "T23:59:59").getTime() - today_ms) / 86400000)
      : null;
    return {
      peptide: b.peptide_id,
      mg_total: b.mg_total,
      days_to_expiry: days,
      cost: b.cost,
      currency: b.currency,
      vendor: b.vendor,
    };
  });
  const expiringSoon = batchInfo.filter(b => b.days_to_expiry !== null && b.days_to_expiry <= 7);

  /* Latest 2 scans for delta */
  const scanDelta = scans.length >= 2 ? {
    latest: scans[0],
    prev: scans[1],
    fat_pct_delta: +(scans[0].fat_pct - scans[1].fat_pct).toFixed(1),
    weight_delta: +(scans[0].weight - scans[1].weight).toFixed(1),
  } : (scans.length === 1 ? {latest: scans[0]} : null);

  return {
    period: {start: d7, end: today, days: 7},
    scans: scanDelta,
    measurements: meas[0] || null,
    peptide_compliance_last_7d: compliance,
    macros: macroAvg,
    wellness: wellnessAvg,
    whoop: whoopAvg,
    active_stack: stack.map(s => ({
      peptide: s.peptide_id, dose: s.dose, schedule: s.schedule,
      status: s.status, time: s.time,
    })),
    active_batches: batchInfo,
    expiring_soon: expiringSoon,
  };
}

function buildPrompt(userId, data) {
  const userName = userId === "kim" ? "Kim" : "Bernadette";
  return `You are an analytical assistant for Body Comp HQ, a personal body composition tracking app. Generate a weekly summary report for ${userName} based on the data below.

Output format: Plain markdown. 250-350 words total. Tone: direct, factual, analytical. Speak directly to ${userName} ("you" not "she"). No medical advice — no dose recommendations, no diagnoses. Use exact numbers from the data — never invent values. If a section has no data, omit it gracefully.

Sections (use ## headings):
1. **Body composition** — scan delta if available, otherwise latest values
2. **Compliance & protocol** — peptide streaks, dose adherence patterns
3. **Recovery & wellness** — Whoop trends, subjective mood/energy/sleep, cross-stream signals
4. **Patterns** — 1-2 cross-stream observations only if genuinely supported by data (e.g., "energy ratings correlate with HRV"). If you can't find a real pattern, write "Nothing notable this week" — don't invent.
5. **Watch this week** — 1-3 specific actionable items: vials expiring, due doses, anomalies worth investigating

End with a brief "Notes" line if there's something genuinely worth flagging (e.g., low data, unusual reading).

Important:
- Don't use phrases like "I notice" or "as an AI" — write as a calm analytical report
- Avoid em-dashes; use semicolons or periods
- Bold key numbers like **38.2%** or **₱4,599**
- Don't moralize about lifestyle choices

Data (JSON):
${JSON.stringify(data, null, 2)}`;
}

async function callGemini(prompt, apiKey) {
  /* Auth via X-goog-api-key header (Google's canonical pattern — keeps key out of URL/logs). */
  const r = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        /* High cap: Gemini 2.5+ uses some output tokens internally for "thinking",
           so a low cap (e.g. 1200) gets eaten before any prose is emitted. 4000 gives margin. */
        maxOutputTokens: 4000,
        /* Disable thinking mode entirely. For a templated narrative summary we don't need
           chain-of-thought reasoning; saves tokens, faster, and prevents silent truncation. */
        thinkingConfig: {thinkingBudget: 0},
      },
      /* Disable safety filters at lowest threshold — health data triggers some false positives */
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
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map(p => p.text || "").join("") || "";
  const finishReason = candidate?.finishReason || "unknown";
  if (!text) {
    throw new Error(`Gemini returned no text. Finish reason: ${finishReason}`);
  }
  /* Surface truncation clearly — STOP is normal, MAX_TOKENS/SAFETY means content was cut off. */
  if (finishReason && finishReason !== "STOP") {
    console.warn(`[ai/weekly] non-STOP finish: ${finishReason}, text=${text.length}ch`);
  }
  return text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ok: false, error: "method"});

  const {user_id} = req.body || {};
  if (user_id !== "kim" && user_id !== "bernadette") {
    return res.status(400).json({ok: false, error: "bad_user"});
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ok: false, error: "no_api_key"});

  const rangeStart = manilaDateOffset(7);
  const rangeEnd   = manilaDateOffset(0);

  try {
    const data = await gatherData(user_id);
    const prompt = buildPrompt(user_id, data);
    const summary = await callGemini(prompt, apiKey);

    /* Cache the result */
    const saveRow = {
      user_id,
      kind: "weekly",
      range_start: rangeStart,
      range_end: rangeEnd,
      summary_md: summary,
      model: MODEL,
      prompt_chars: prompt.length,
      completion_chars: summary.length,
    };
    await fetch(`${SB_URL}/ai_summaries`, {
      method: "POST",
      headers: sbHdr,
      body: JSON.stringify(saveRow),
    });

    return res.status(200).json({
      ok: true,
      summary_md: summary,
      generated_at: new Date().toISOString(),
      model: MODEL,
    });
  } catch (e) {
    console.error("[ai/weekly] failed", e);
    /* Log the failure so we can see it later */
    try {
      await fetch(`${SB_URL}/ai_summaries`, {
        method: "POST",
        headers: sbHdr,
        body: JSON.stringify({
          user_id, kind: "weekly",
          range_start: rangeStart, range_end: rangeEnd,
          error: String(e.message || e).slice(0, 1000),
          model: MODEL,
        }),
      });
    } catch {}
    return res.status(500).json({ok: false, error: String(e.message || e)});
  }
}
