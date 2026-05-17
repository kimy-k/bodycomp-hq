/* ═══ POST /api/push/unsubscribe ═══
   Body: { endpoint }
   Effect: deletes the push_subscriptions row matching endpoint. */

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error: "method not allowed"});
  if (!SB_SERVICE_KEY) return res.status(500).json({error: "server not configured"});

  const {endpoint} = req.body || {};
  if (!endpoint) return res.status(400).json({error: "missing endpoint"});

  try {
    const r = await fetch(`${SB_URL}/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: "DELETE",
      headers: {apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}`},
    });
    if (!r.ok) {
      console.error("[push/unsubscribe] supabase", r.status);
      return res.status(500).json({error: "delete failed"});
    }
    return res.status(200).json({ok: true});
  } catch (e) {
    console.error("[push/unsubscribe] threw", e);
    return res.status(500).json({error: "delete failed"});
  }
}
