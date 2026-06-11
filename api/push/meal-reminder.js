/* ═══ POST /api/push/meal-reminder ═══
   Vercel Cron: runs at 11:00 UTC (7 PM Manila).
   For each user with push subscriptions:
     - Check if they've logged any meals today
     - If 0 meals logged AND protein is 0, send a nudge
   Auth: CRON_SECRET header required. */

import webpush from "web-push";

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@bodycomp-hq.app";
const CRON_SECRET = process.env.CRON_SECRET;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const hdr = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

const todayManila = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
};

export default async function handler(req, res) {
  /* Auth check */
  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (CRON_SECRET && auth !== CRON_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!SB_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: "missing_env", message: "Push env vars not configured" });
  }

  const today = todayManila();
  let sent = 0;
  let skipped = 0;

  try {
    /* Get all users with push subscriptions */
    const subResp = await fetch(`${SB_URL}/push_subscriptions?select=user_id,subscription`, { headers: hdr });
    const subs = await subResp.json();
    if (!Array.isArray(subs) || subs.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, message: "No subscriptions" });
    }

    /* Group by user */
    const byUser = {};
    subs.forEach(s => {
      if (!byUser[s.user_id]) byUser[s.user_id] = [];
      byUser[s.user_id].push(s.subscription);
    });

    for (const [userId, userSubs] of Object.entries(byUser)) {
      /* Check if meals logged today */
      const macroResp = await fetch(`${SB_URL}/daily_macros?user_id=eq.${userId}&date=eq.${today}&select=meals`, { headers: hdr });
      const macroRows = await macroResp.json();
      const meals = macroRows?.[0]?.meals || [];
      const mealCount = Array.isArray(meals) ? meals.length : 0;

      /* Get user config for name and targets */
      const cfgResp = await fetch(`${SB_URL}/config?user_id=eq.${userId}&key=eq.profile&select=value`, { headers: hdr });
      const cfgRows = await cfgResp.json();
      const profile = cfgRows?.[0]?.value || {};
      const name = profile.name || userId;
      const proteinTarget = profile.targets?.protein || 150;

      if (mealCount > 0) {
        skipped++;
        continue; /* Already logged today */
      }

      /* Check if we already sent a meal reminder today */
      const logResp = await fetch(`${SB_URL}/push_reminder_log?user_id=eq.${userId}&date=eq.${today}&type=eq.meal_reminder&select=id`, { headers: hdr });
      const logRows = await logResp.json();
      if (Array.isArray(logRows) && logRows.length > 0) {
        skipped++;
        continue; /* Already sent today */
      }

      /* Send push */
      const body = `${name}, you haven't logged any meals today. 0/${proteinTarget}g protein so far — still time to hit your target.`;
      const payload = JSON.stringify({
        title: "Log your meals 🍽️",
        body,
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
        tag: "meal-reminder",
        data: { url: "/" },
      });

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(typeof sub === "string" ? JSON.parse(sub) : sub, payload);
          sent++;
        } catch (err) {
          /* 410 Gone = subscription expired, clean up */
          if (err.statusCode === 410) {
            await fetch(`${SB_URL}/push_subscriptions?user_id=eq.${userId}&subscription=eq.${encodeURIComponent(JSON.stringify(sub))}`, {
              method: "DELETE", headers: hdr,
            });
          }
        }
      }

      /* Log that we sent it */
      await fetch(`${SB_URL}/push_reminder_log`, {
        method: "POST",
        headers: { ...hdr, Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, date: today, type: "meal_reminder" }),
      });
    }

    return res.status(200).json({ ok: true, sent, skipped, date: today });
  } catch (err) {
    return res.status(500).json({ error: "internal", message: err.message });
  }
}
