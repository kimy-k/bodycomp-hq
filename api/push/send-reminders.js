/* ═══ POST /api/push/send-reminders ═══
   Triggered by Vercel Cron (every 5 min). Iterates active push_subscriptions,
   computes each user's overdue peptides for their local-time today, sends a
   push, and logs to push_reminder_log to suppress duplicates within the day.

   Auth: requires header `Authorization: Bearer ${CRON_SECRET}` to prevent
   public abuse. Vercel Cron auto-includes this when CRON_SECRET env is set.

   The function fetches:
     1. All distinct user_ids with subscriptions
     2. For each user:
          - Their peptide_stack (enabled=true)
          - Their daily_peptides row for today (their local date)
          - Their push_reminder_log rows for today
        For each enabled peptide:
          - Compute due state (using their TZ, defaulting to Asia/Manila)
          - If overdue >15 min AND not already checked AND no reminder sent today, push.

   Note: We don't know each user's actual timezone — we assume Asia/Manila for
   now. To support more, store tz on a user_settings table later. */

import webpush from "web-push";

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@bodycomp-hq.app";
const CRON_SECRET = process.env.CRON_SECRET;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const USER_TZ = "Asia/Manila"; // TODO: per-user tz preference

/* Local "YYYY-MM-DD" in the user's tz */
const userTodayKey = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", {timeZone: USER_TZ, year: "numeric", month: "2-digit", day: "2-digit"});
  return fmt.format(new Date());
};

/* Local day-of-week 0..6 (Sun..Sat) */
const userTodayDow = () => {
  const fmt = new Intl.DateTimeFormat("en-US", {timeZone: USER_TZ, weekday: "short"});
  const map = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6};
  return map[fmt.format(new Date())];
};

/* "AM"/"PM"/"8:00am"/"13:30" → {h, m} or null. Mirrors parseTimeStr in bcq-math.js. */
function parseTimeStr(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (t === "am") return {h: 8, m: 0};
  if (t === "pm") return {h: 20, m: 0};
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] || 0);
  const ampm = m[3];
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return {h, m: min};
}

/* Current minute-of-day in the user's tz. */
function userMinuteOfDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: USER_TZ, hour12: false, hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const h = +parts.find(p => p.type === "hour").value;
  const m = +parts.find(p => p.type === "minute").value;
  return h * 60 + m;
}

async function sb(path, init = {}) {
  return fetch(`${SB_URL}${path}`, {
    ...init,
    headers: {
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({error: "method not allowed"});
  }
  // Cron auth — Vercel Cron sends Authorization: Bearer ${CRON_SECRET}
  if (CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({error: "unauthorized"});
  }
  if (!SB_SERVICE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({error: "server not configured"});
  }

  const today = userTodayKey();
  const dow = userTodayDow();
  const nowMin = userMinuteOfDay();
  const stats = {users: 0, candidates: 0, sent: 0, skipped: 0, failed: 0, errors: []};

  try {
    // 1. Get distinct user_ids with subscriptions
    const subsR = await sb("/push_subscriptions?select=user_id,id,endpoint,p256dh,auth&failure_count=lt.5");
    if (!subsR.ok) throw new Error(`fetch subs: ${subsR.status}`);
    const subs = await subsR.json();
    const subsByUser = {};
    for (const s of subs) {
      (subsByUser[s.user_id] = subsByUser[s.user_id] || []).push(s);
    }
    stats.users = Object.keys(subsByUser).length;

    // 2. Process each user
    for (const userId of Object.keys(subsByUser)) {
      // 2a. Load their stack
      const stackR = await sb(`/peptide_stack?user_id=eq.${userId}&enabled=eq.true&select=peptide_id,dose,schedule,time,status`);
      if (!stackR.ok) continue;
      const stack = await stackR.json();

      // 2b. Load today's daily_peptides
      const dpR = await sb(`/daily_peptides?user_id=eq.${userId}&date=eq.${today}&select=checks`);
      const dpRows = dpR.ok ? await dpR.json() : [];
      const checks = (dpRows[0] && dpRows[0].checks) || {};

      // 2c. Load today's reminder log
      const logR = await sb(`/push_reminder_log?user_id=eq.${userId}&date=eq.${today}&select=peptide_id`);
      const logRows = logR.ok ? await logR.json() : [];
      const alreadyRemindedIds = new Set(logRows.map(r => r.peptide_id));

      // 2d. Find overdue peptides
      for (const pep of stack) {
        if (pep.status !== "active" && pep.status !== "prn") continue;
        if (!Array.isArray(pep.schedule) || !pep.schedule.includes(dow)) continue;
        if (checks[pep.peptide_id]) continue;                  // already taken
        if (alreadyRemindedIds.has(pep.peptide_id)) continue;  // already reminded today

        const t = parseTimeStr(pep.time);
        if (!t) continue;
        const schedMin = t.h * 60 + t.m;
        const overdueMin = nowMin - schedMin;
        // Fire when overdue between 15 min and 12 hours (don't ping at 3 AM for an 8 AM dose)
        if (overdueMin < 15 || overdueMin > 720) continue;
        stats.candidates++;

        // 2e. Send to all subscriptions for this user
        const payload = JSON.stringify({
          title: `${pep.peptide_id} — overdue`,
          body: `${pep.dose} · ${overdueMin >= 60 ? Math.round(overdueMin / 60) + "h" : Math.round(overdueMin) + "min"} late`,
          tag: `bcq-${pep.peptide_id}-${today}`,
          peptideId: pep.peptide_id,
          url: "/?tab=peptides",
        });

        let anyOk = false;
        for (const s of subsByUser[userId]) {
          const pushSub = {endpoint: s.endpoint, keys: {p256dh: s.p256dh, auth: s.auth}};
          try {
            await webpush.sendNotification(pushSub, payload);
            anyOk = true;
            stats.sent++;
            // mark success
            await sb(`/push_subscriptions?id=eq.${s.id}`, {
              method: "PATCH",
              body: JSON.stringify({last_sent_at: new Date().toISOString(), failure_count: 0, last_failed_at: null}),
            });
          } catch (e) {
            stats.failed++;
            const status = e.statusCode;
            // 404/410 means subscription is permanently dead — delete after 3 strikes
            const permanent = status === 404 || status === 410;
            await sb(`/push_subscriptions?id=eq.${s.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                last_failed_at: new Date().toISOString(),
                failure_count: permanent ? 10 : 1,
              }),
            });
            stats.errors.push({sub: s.id, status, msg: (e.body || "").slice(0, 100)});
          }
        }

        // 2f. Log so we don't re-send today
        if (anyOk) {
          await sb("/push_reminder_log", {
            method: "POST",
            headers: {Prefer: "resolution=ignore-duplicates"},
            body: JSON.stringify({user_id: userId, peptide_id: pep.peptide_id, date: today}),
          });
        }
      }
    }

    return res.status(200).json({today, dow, nowMin, ...stats});
  } catch (e) {
    console.error("[send-reminders] threw", e);
    return res.status(500).json({error: e.message, stats});
  }
}
