/* ═══ POST /api/push/test ═══
   Body: { user_id }
   Effect: sends a test push to every active subscription belonging to user_id.
   Used by the Settings "Send test notification" button. */

import webpush from "web-push";

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@bodycomp-hq.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error: "method not allowed"});
  if (!SB_SERVICE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({error: "server not configured — env vars missing"});
  }

  const {user_id} = req.body || {};
  if (!user_id) return res.status(400).json({error: "missing user_id"});

  try {
    const r = await fetch(`${SB_URL}/push_subscriptions?user_id=eq.${user_id}&select=id,endpoint,p256dh,auth`, {
      headers: {apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}`},
    });
    if (!r.ok) return res.status(500).json({error: "fetch subscriptions failed"});
    const subs = await r.json();
    if (subs.length === 0) return res.status(404).json({error: "no subscriptions for this user — enable notifications first"});

    const payload = JSON.stringify({
      title: "Body Comp HQ — test",
      body: "If you see this, push is working ✓",
      tag: "bcq-test",
      url: "/",
    });

    const results = await Promise.all(subs.map(async (s) => {
      const pushSub = {endpoint: s.endpoint, keys: {p256dh: s.p256dh, auth: s.auth}};
      try {
        await webpush.sendNotification(pushSub, payload);
        return {id: s.id, ok: true};
      } catch (e) {
        return {id: s.id, ok: false, status: e.statusCode, body: e.body};
      }
    }));

    return res.status(200).json({sent: results.length, results});
  } catch (e) {
    console.error("[push/test] threw", e);
    return res.status(500).json({error: "send failed"});
  }
}
