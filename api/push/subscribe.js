/* ═══ POST /api/push/subscribe ═══
   Body: { user_id, subscription: { endpoint, keys: { p256dh, auth } }, ua? }
   Effect: upserts a push_subscriptions row keyed by endpoint. */

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error: "method not allowed"});
  if (!SB_SERVICE_KEY) return res.status(500).json({error: "server not configured"});

  const {user_id, subscription, ua} = req.body || {};
  if (!user_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({error: "missing fields"});
  }

  try {
    const r = await fetch(`${SB_URL}/push_subscriptions?on_conflict=endpoint`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE_KEY,
        Authorization: `Bearer ${SB_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        ua: ua || null,
        failure_count: 0,
        last_failed_at: null,
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      console.error("[push/subscribe] supabase error", r.status, text);
      return res.status(500).json({error: "save failed"});
    }
    const data = await r.json();
    return res.status(200).json({ok: true, id: data[0]?.id});
  } catch (e) {
    console.error("[push/subscribe] threw", e);
    return res.status(500).json({error: "save failed"});
  }
}
