/* ═══ GET /api/whoop/callback ═══
   Whoop redirects here after the user authorizes the BCQ app.
   Query: { code, state } where state has form "{user_id}.{nonce}".
   Effect:
     1. Exchange the auth code for access+refresh tokens (server-side, needs client_secret)
     2. Fetch the Whoop user's basic profile (id, email) for sanity-checking
     3. Upsert into whoop_tokens table (one row per BCQ user)
     4. 302 redirect back to /?user={user_id}&tab=whoop&whoop=connected
   On failure: redirect with ?whoop=error&msg=...

   Env vars required: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
*/

const SB_URL = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdGlucGd3aHBqd29vaHBramduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTI4MzksImV4cCI6MjA5NDQ4ODgzOX0.XVrnWxg4MXOB9iBxkq9rP9T8XBsBjS8Ff85jC4MhLPc";

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_PROFILE_URL = "https://api.prod.whoop.com/developer/v2/user/profile/basic";
const REDIRECT_URI = "https://bodycomp-hq.vercel.app/api/whoop/callback";

function bounceBack(res, params) {
  const qs = new URLSearchParams(params).toString();
  res.writeHead(302, {Location: `/?${qs}`});
  res.end();
}

export default async function handler(req, res) {
  const {code, state, error} = req.query || {};

  if (error) return bounceBack(res, {tab: "whoop", whoop: "error", msg: error});
  if (!code || !state) return bounceBack(res, {tab: "whoop", whoop: "error", msg: "missing_code"});

  /* State format: "{user_id}.{nonce}" — extract user_id */
  const userId = String(state).split(".")[0];
  if (!userId || (userId !== "kim" && userId !== "bernadette")) {
    return bounceBack(res, {tab: "whoop", whoop: "error", msg: "bad_state"});
  }

  const CLIENT_ID = process.env.WHOOP_CLIENT_ID;
  const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return bounceBack(res, {user: userId, tab: "whoop", whoop: "error", msg: "no_creds"});
  }

  try {
    /* 1. Exchange code for tokens */
    const tokenResp = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      console.error("[whoop/callback] token exchange failed", tokenResp.status, t);
      return bounceBack(res, {user: userId, tab: "whoop", whoop: "error", msg: "token_exchange"});
    }
    const tokens = await tokenResp.json();
    /* tokens = {access_token, refresh_token, expires_in, scope, token_type} */
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    /* 2. Fetch Whoop user profile for sanity-check (non-fatal if it fails) */
    let whoopUserId = null;
    let whoopEmail = null;
    try {
      const profResp = await fetch(WHOOP_PROFILE_URL, {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
      });
      if (profResp.ok) {
        const prof = await profResp.json();
        whoopUserId = prof.user_id ?? prof.id ?? null;
        whoopEmail = prof.email ?? null;
      }
    } catch (e) { console.warn("[whoop/callback] profile fetch failed", e); }

    /* 3. Upsert into whoop_tokens */
    const sb = await fetch(`${SB_URL}/whoop_tokens?on_conflict=user_id`, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        whoop_user_id: whoopUserId,
        whoop_email: whoopEmail,
        scope: tokens.scope,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
      }),
    });
    if (!sb.ok) {
      const t = await sb.text();
      console.error("[whoop/callback] supabase upsert failed", sb.status, t);
      return bounceBack(res, {user: userId, tab: "whoop", whoop: "error", msg: "db_save"});
    }

    /* 4. Success — redirect back to app, frontend will auto-trigger initial sync */
    return bounceBack(res, {user: userId, tab: "whoop", whoop: "connected"});
  } catch (e) {
    console.error("[whoop/callback] unexpected", e);
    return bounceBack(res, {user: userId, tab: "whoop", whoop: "error", msg: "exception"});
  }
}
