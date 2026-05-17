/* ═══ POST /api/whoop/sync ═══
   Body: { user_id }
   Effect:
     1. Load whoop_tokens for user
     2. If expires_at within next 60s, refresh tokens (and store new ones)
     3. Fetch /developer/v2/cycle, /developer/v2/recovery, /developer/v2/activity/sleep
        for last 30 days, in parallel
     4. Merge by cycle_id → one daily_whoop row per cycle
     5. Date assignment: cycle.start converted to Manila local date (UTC+8)
     6. Upsert daily_whoop rows
     7. Update whoop_tokens.last_sync_at + last_sync_count
   Returns: { ok: true, synced: N, error: null } or { ok: false, error: "..." }

   Env vars required: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET (for token refresh)
*/

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdGlucGd3aHBqd29vaHBramduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTI4MzksImV4cCI6MjA5NDQ4ODgzOX0.XVrnWxg4MXOB9iBxkq9rP9T8XBsBjS8Ff85jC4MhLPc";

const WHOOP_BASE = "https://api.prod.whoop.com";
const WHOOP_TOKEN_URL = `${WHOOP_BASE}/oauth/oauth2/token`;

/* Convert UTC ISO timestamp to Manila local date string (YYYY-MM-DD). */
function dateInManila(iso) {
  const d = new Date(iso);
  /* Add 8h for Manila offset, then read UTC components as if they were local */
  const m = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return m.toISOString().slice(0, 10);
}

const sbHdr = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

async function refreshAccessToken(refreshToken) {
  const CLIENT_ID = process.env.WHOOP_CLIENT_ID;
  const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
  const r = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "offline",
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`token refresh ${r.status}: ${t}`);
  }
  return r.json();  /* { access_token, refresh_token, expires_in, scope } */
}

async function loadTokens(userId) {
  const r = await fetch(`${SB_URL}/whoop_tokens?user_id=eq.${userId}&select=*`, {headers: sbHdr});
  if (!r.ok) throw new Error(`load tokens ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}

async function saveTokens(userId, tokens) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const r = await fetch(`${SB_URL}/whoop_tokens?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: sbHdr,
    body: JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.warn("[whoop/sync] save tokens failed", r.status, t);
  }
}

async function fetchWhoop(path, accessToken, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${WHOOP_BASE}${path}${qs ? "?" + qs : ""}`;
  const r = await fetch(url, {headers: {Authorization: `Bearer ${accessToken}`}});
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${path} ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ok: false, error: "method"});

  const {user_id} = req.body || {};
  if (user_id !== "kim" && user_id !== "bernadette") {
    return res.status(400).json({ok: false, error: "bad_user"});
  }

  try {
    /* 1. Load tokens */
    let tokens = await loadTokens(user_id);
    if (!tokens) return res.status(404).json({ok: false, error: "not_connected"});

    /* 2. Refresh if expiring within 60s */
    const expMs = new Date(tokens.expires_at).getTime();
    if (expMs - Date.now() < 60_000) {
      const fresh = await refreshAccessToken(tokens.refresh_token);
      await saveTokens(user_id, fresh);
      tokens = {...tokens, access_token: fresh.access_token, refresh_token: fresh.refresh_token};
    }

    /* 3. Fetch 3 endpoints in parallel.
       Date range: last 30 days. Each endpoint returns paginated; limit=25 is the API max. */
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const params = {limit: "25", start: since};
    const [cycleData, recoveryData, sleepData] = await Promise.all([
      fetchWhoop("/developer/v2/cycle", tokens.access_token, params),
      fetchWhoop("/developer/v2/recovery", tokens.access_token, params),
      fetchWhoop("/developer/v2/activity/sleep", tokens.access_token, params),
    ]);

    const cycles = cycleData.records || [];
    const recoveries = recoveryData.records || [];
    const sleeps = sleepData.records || [];

    /* 4. Build lookup maps. Recovery has sleep_id; sleep has cycle_id; cycle has id. */
    const recoveryBySleepId = new Map();
    for (const r of recoveries) {
      const sid = r.sleep_id ?? r.sleep_uuid ?? r.score?.sleep_id;
      if (sid) recoveryBySleepId.set(sid, r);
    }
    const sleepByCycleId = new Map();
    for (const s of sleeps) {
      const cid = s.cycle_id ?? s.cycle_uuid;
      if (cid) sleepByCycleId.set(cid, s);
    }

    /* 5. For each cycle, build a daily_whoop row */
    const rows = [];
    for (const cycle of cycles) {
      if (!cycle.start) continue;
      const date = dateInManila(cycle.start);
      const sleep = sleepByCycleId.get(cycle.id);
      const recovery = sleep ? recoveryBySleepId.get(sleep.id) : null;
      /* Extract scores defensively — Whoop nests inside `score` */
      const recScore = recovery?.score || {};
      const slpScore = sleep?.score || {};
      const cycScore = cycle.score || {};
      /* Sleep total time: prefer stage_summary if available */
      let sleepHours = null;
      const totalMs = slpScore.stage_summary?.total_in_bed_time_milli ?? slpScore.total_in_bed_time_milli;
      if (totalMs) sleepHours = +(totalMs / (1000 * 60 * 60)).toFixed(2);
      rows.push({
        user_id,
        date,
        recovery: recScore.recovery_score ?? null,
        sleep: slpScore.sleep_performance_percentage ?? null,
        strain: cycScore.strain ?? null,
        hrv_ms: recScore.hrv_rmssd_milli ?? null,
        rhr: recScore.resting_heart_rate ?? null,
        sleep_hours: sleepHours,
        sleep_efficiency: slpScore.sleep_efficiency_percentage ?? null,
        source: "whoop_sync",
        synced_at: new Date().toISOString(),
      });
    }

    /* 6. Dedupe rows by date BEFORE upserting.
       Two Whoop cycles can map to the same Manila date when:
         - User has a split cycle (e.g. nap + main sleep both starting same calendar day)
         - Timezone boundary edge case (cycle starting near midnight UTC)
       Postgres ON CONFLICT can't update the same row twice in one statement → error 21000.
       Strategy: keep the FIRST row encountered for each date (Whoop returns cycles
       sorted by start DESC, so the first is the most recent), but fill in any null
       fields from later/older rows for that same date. */
    const byDate = new Map();
    for (const row of rows) {
      const existing = byDate.get(row.date);
      if (!existing) {
        byDate.set(row.date, row);
      } else {
        byDate.set(row.date, {
          ...existing,
          recovery:         existing.recovery         ?? row.recovery,
          sleep:            existing.sleep            ?? row.sleep,
          strain:           existing.strain           ?? row.strain,
          hrv_ms:           existing.hrv_ms           ?? row.hrv_ms,
          rhr:              existing.rhr              ?? row.rhr,
          sleep_hours:      existing.sleep_hours      ?? row.sleep_hours,
          sleep_efficiency: existing.sleep_efficiency ?? row.sleep_efficiency,
        });
      }
    }
    const dedupedRows = Array.from(byDate.values());
    if (rows.length !== dedupedRows.length) {
      console.log(`[whoop/sync] deduped ${rows.length} cycles → ${dedupedRows.length} unique dates`);
    }

    /* 7. Upsert all dedupted rows in one batch */
    if (dedupedRows.length > 0) {
      const upsert = await fetch(`${SB_URL}/daily_whoop?on_conflict=user_id,date`, {
        method: "POST",
        headers: {...sbHdr, Prefer: "resolution=merge-duplicates"},
        body: JSON.stringify(dedupedRows),
      });
      if (!upsert.ok) {
        const t = await upsert.text();
        throw new Error(`upsert ${upsert.status}: ${t.slice(0, 200)}`);
      }
    }

    /* 7. Update token row meta */
    await fetch(`${SB_URL}/whoop_tokens?user_id=eq.${user_id}`, {
      method: "PATCH",
      headers: sbHdr,
      body: JSON.stringify({
        last_sync_at: new Date().toISOString(),
        last_sync_count: dedupedRows.length,
        last_sync_error: null,
      }),
    });

    return res.status(200).json({ok: true, synced: dedupedRows.length});
  } catch (e) {
    console.error("[whoop/sync] error", e);
    /* Try to record the error on the token row so the UI can show it */
    try {
      await fetch(`${SB_URL}/whoop_tokens?user_id=eq.${user_id}`, {
        method: "PATCH",
        headers: sbHdr,
        body: JSON.stringify({last_sync_error: String(e.message || e).slice(0, 500)}),
      });
    } catch {}
    return res.status(500).json({ok: false, error: String(e.message || e)});
  }
}
