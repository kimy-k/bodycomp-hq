/* ═══ POST /api/ai/daily-briefing ═══
   Body: { user_id }
   Returns today's 60-80 word morning briefing for the user.
   Cached same-day: first call generates via Gemini + stores in ai_summaries,
   subsequent calls return the cached row. Cost amortizes to ~$0.001/user/day.

   Structure of summary_md (rendered by client):
     **Overnight** — one sentence about last night.

     **Today** — one sentence about what matters today.

     **Watch** — one sentence flagging one thing.
*/

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdGlucGd3aHBqd29vaHBramduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTI4MzksImV4cCI6MjA5NDQ4ODgzOX0.XVrnWxg4MXOB9iBxkq9rP9T8XBsBjS8Ff85jC4MhLPc";

const MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const sbHdr = {apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json"};

/* ISO date n days ago in Manila TZ (UTC+8) */
function manilaDateOffset(daysBack) {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

async function sbSelect(table, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${SB_URL}/${table}?${qs}`, {headers: sbHdr});
  if (!r.ok) {
    console.warn(`[ai/daily] ${table} ${r.status}`);
    return [];
  }
  return r.json();
}

/* Gather TODAY's snapshot + 14-day baseline for the briefing prompt.
   Tighter window than weekly (which uses 7-14 days). */
async function gatherDailyData(userId) {
  const today = manilaDateOffset(0);
  const d3   = manilaDateOffset(3);
  const d14  = manilaDateOffset(14);

  const [whoop14, peps14, macrosToday, wellnessToday, stack, batches] = await Promise.all([
    sbSelect("daily_whoop",     {user_id: `eq.${userId}`, date: `gte.${d14}`, select: "date,recovery,sleep,strain,hrv_ms,rhr,sleep_hours,sleep_efficiency", order: "date.desc"}),
    sbSelect("daily_peptides",  {user_id: `eq.${userId}`, date: `gte.${d14}`, select: "date,checks,side_effects", order: "date.desc"}),
    sbSelect("daily_macros",    {user_id: `eq.${userId}`, date: `eq.${today}`, select: "date,calories,protein_g,fat_g,carbs_g"}),
    sbSelect("daily_wellness",  {user_id: `eq.${userId}`, date: `eq.${today}`, select: "date,mood,energy,sleep_quality,notes"}),
    sbSelect("peptide_stack",   {user_id: `eq.${userId}`, enabled: "eq.true", select: "peptide_id,dose,schedule,time,status,total_weeks,start_date"}),
    sbSelect("peptide_batches", {user_id: `eq.${userId}`, exhausted: "eq.false", select: "peptide_id,expiry_date"}),
  ]);

  /* Today's Whoop row — and a fallback for Whoop's date convention.
     Whoop labels recovery by the SLEEP DATE (the night that produced the score),
     so on a Monday morning the "current" recovery may be filed under Sunday's date
     until Monday's own sync happens. Treat the most recent row within 1 day as
     current; only beyond that count it as stale. */
  const sortedWhoop = [...whoop14].sort((a,b) => b.date.localeCompare(a.date));
  const latestWhoop = sortedWhoop[0] || null;
  const latestDate = latestWhoop?.date;
  const latestDaysOld = latestDate
    ? Math.round((new Date(today + "T12:00:00").getTime() - new Date(latestDate + "T12:00:00").getTime()) / 86400000)
    : null;
  const todayWhoop = latestWhoop && latestDaysOld != null && latestDaysOld <= 1 ? latestWhoop : null;

  /* 14-day Whoop baselines for "X% below avg" claims */
  const whoopValid = whoop14.filter(w => w.date < today);  /* exclude today from baseline */
  const baseline = whoopValid.length >= 3 ? {
    days: whoopValid.length,
    avg_recovery: Math.round(whoopValid.reduce((s,r) => s + (r.recovery || 0), 0) / whoopValid.length),
    avg_hrv: whoopValid.some(r => r.hrv_ms) ? +(whoopValid.filter(r => r.hrv_ms).reduce((s,r) => s + +r.hrv_ms, 0) / whoopValid.filter(r => r.hrv_ms).length).toFixed(1) : null,
    avg_rhr: whoopValid.some(r => r.rhr) ? Math.round(whoopValid.filter(r => r.rhr).reduce((s,r) => s + r.rhr, 0) / whoopValid.filter(r => r.rhr).length) : null,
    avg_sleep_h: whoopValid.some(r => r.sleep_hours) ? +(whoopValid.filter(r => r.sleep_hours).reduce((s,r) => s + +r.sleep_hours, 0) / whoopValid.filter(r => r.sleep_hours).length).toFixed(2) : null,
  } : null;

  /* Last 3 days (excluding today) — short-term trend signal */
  const recent3 = whoop14.filter(w => w.date < today && w.date >= d3)
    .map(r => ({date: r.date, recovery: r.recovery, hrv: r.hrv_ms, sleep_h: r.sleep_hours}));

  /* Peptides due today by day-of-week. JS getDay returns 0=Sun..6=Sat,
     matching how the app stores schedules.
     A "starting" peptide with start_date in the past is functionally active. */
  const todayDow = new Date(today + "T12:00:00").getDay();
  const dueToday = stack.filter(s => {
    const live = s.status === "active"
              || s.status === "prn"
              || (s.status === "starting" && s.start_date && s.start_date <= today);
    if (!live) return false;
    const sched = Array.isArray(s.schedule) ? s.schedule : [];
    return sched.includes(todayDow);
  }).map(s => ({peptide: s.peptide_id, dose: s.dose, time: s.time}));

  /* What's already been logged today */
  const todayPepRow = peps14.find(p => p.date === today);
  const loggedToday = todayPepRow ? Object.keys(todayPepRow.checks || {}) : [];

  /* Compute current streak per peptide over last 14 days (consecutive due-and-logged days) */
  const streaks = {};
  for (const s of stack) {
    const live = s.status === "active"
              || s.status === "prn"
              || (s.status === "starting" && s.start_date && s.start_date <= today);
    if (!live) continue;
    const id = s.peptide_id;
    const sched = Array.isArray(s.schedule) ? s.schedule : [];
    if (sched.length === 0) continue;
    let streak = 0;
    /* Walk backwards from yesterday, counting days where peptide was DUE and TAKEN */
    for (let i = 1; i < 30; i++) {
      const d = manilaDateOffset(i);
      const dow = new Date(d + "T12:00:00").getDay();
      if (!sched.includes(dow)) continue;
      const row = peps14.find(p => p.date === d);
      if (row?.checks?.[id]) streak++;
      else break;
    }
    if (streak >= 3) streaks[id] = streak;
  }

  /* Batches expiring soon */
  const todayMs = Date.now();
  const expiringSoon = batches
    .filter(b => b.expiry_date)
    .map(b => ({
      peptide: b.peptide_id,
      days: Math.round((new Date(b.expiry_date + "T23:59:59").getTime() - todayMs) / 86400000),
    }))
    .filter(b => b.days >= 0 && b.days <= 7);

  /* Recent low-recovery streak (last 7 days where recovery < 50%) */
  const recent7 = whoop14.filter(w => w.date >= manilaDateOffset(7));
  const lowRecoveryCount = recent7.filter(w => (w.recovery || 100) < 50).length;

  return {
    date: today,
    day_of_week: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][todayDow],
    whoop_today: todayWhoop ? {
      reading_date: todayWhoop.date,         /* may be yesterday's date — Whoop convention */
      days_old: latestDaysOld,                /* 0 = filed under today, 1 = filed under yesterday (typical morning) */
      recovery: todayWhoop.recovery,
      sleep_h: todayWhoop.sleep_hours,
      sleep_efficiency: todayWhoop.sleep_efficiency,
      hrv: todayWhoop.hrv_ms,
      rhr: todayWhoop.rhr,
      strain: todayWhoop.strain,
    } : null,
    whoop_14d_baseline: baseline,
    whoop_recent_3d: recent3,
    peptides_due_today: dueToday,
    peptides_logged_today: loggedToday,
    streaks_3plus_days: streaks,
    macros_today: macrosToday[0] || null,
    wellness_today: wellnessToday[0] || null,
    batches_expiring_within_7d: expiringSoon,
    low_recovery_days_last_7: lowRecoveryCount,
  };
}

function buildPrompt(userId, data) {
  const name = userId === "kim" ? "Kim" : "Bernadette";
  return `You are a focused wellness analyst for Body Comp HQ. Generate a 60-80 word morning briefing for ${name}.

Output exactly three short paragraphs, each starting with a bolded label, separated by blank lines. NO headings, NO bullet lists, NO extra prose.

**Overnight** — One sentence about last night's sleep and current recovery state: sleep hours, HRV, recovery score, brief comparison to baseline if useful. Use exact numbers from the data. Note: Whoop dates each recovery score by the SLEEP NIGHT, so a row filed under yesterday's date IS this morning's reading (treat \`whoop_today\` as current whenever it is not null, regardless of \`reading_date\`). Only if \`whoop_today\` is null entirely, say "Whoop hasn't synced yet for today."

**Today** — One sentence about what matters today: which peptides are due, day of week, current macro/protein progress if logged.

**Watch** — One sentence flagging the single most important pattern, risk, or anomaly: a streak about to break, a batch expiring, multiple low-recovery days in a row, or a metric trending hard. Pick ONE. If nothing acute, write "Nothing acute. Steady day."

Rules:
- Plain markdown. NO em-dashes; use periods or semicolons.
- Speak directly to ${name} ("you" not "she" not "they").
- Never invent numbers — only use values from the data below.
- No medical advice, no moralizing.
- Total output: 60-80 words. Be sparse, factual, calm.

Data (JSON):
${JSON.stringify(data, null, 2)}`;
}

async function callGemini(prompt, apiKey) {
  const r = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-goog-api-key": apiKey},
    body: JSON.stringify({
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        /* Daily briefing is much shorter than weekly (~80 words vs ~300).
           1500 cap is generous; Gemini 2.5 needs some headroom for internal "thinking"
           even with thinkingBudget=0. */
        maxOutputTokens: 1500,
        thinkingConfig: {thinkingBudget: 0},
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
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map(p => p.text || "").join("") || "";
  const finishReason = candidate?.finishReason || "unknown";
  if (!text) throw new Error(`Gemini returned no text. Finish reason: ${finishReason}`);
  if (finishReason && finishReason !== "STOP") {
    console.warn(`[ai/daily] non-STOP finish: ${finishReason}, text=${text.length}ch`);
  }
  return text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ok: false, error: "method"});

  const {user_id, force} = req.body || {};
  if (user_id !== "kim" && user_id !== "bernadette") {
    return res.status(400).json({ok: false, error: "bad_user"});
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ok: false, error: "no_api_key"});

  const today = manilaDateOffset(0);

  /* CACHE CHECK: did we already generate a daily briefing for this user today?
     Skip cache if force=true (manual refresh). */
  if (!force) {
    const cached = await sbSelect("ai_summaries", {
      user_id: `eq.${user_id}`,
      kind: `eq.daily`,
      range_end: `eq.${today}`,
      select: "summary_md,generated_at",
      order: "generated_at.desc",
      limit: "1",
    });
    if (cached.length && cached[0].summary_md) {
      return res.status(200).json({
        ok: true,
        cached: true,
        summary_md: cached[0].summary_md,
        generated_at: cached[0].generated_at,
        model: MODEL,
      });
    }
  }

  /* GENERATE */
  try {
    const data = await gatherDailyData(user_id);
    const prompt = buildPrompt(user_id, data);
    const summary = await callGemini(prompt, apiKey);

    /* Cache the result. Schema: summary_md is NOT NULL, generated_at auto-defaults to now(). */
    await fetch(`${SB_URL}/ai_summaries`, {
      method: "POST",
      headers: sbHdr,
      body: JSON.stringify({
        user_id,
        kind: "daily",
        range_start: today,
        range_end: today,
        summary_md: summary,
        provider: "google",
        model: MODEL,
      }),
    });

    return res.status(200).json({
      ok: true,
      cached: false,
      summary_md: summary,
      generated_at: new Date().toISOString(),
      model: MODEL,
    });
  } catch (e) {
    /* Don't try to insert an error row — summary_md is NOT NULL.
       Vercel logs already capture the console.error below. */
    console.error("[ai/daily] failed", e);
    return res.status(500).json({ok: false, error: String(e.message || e)});
  }
}
