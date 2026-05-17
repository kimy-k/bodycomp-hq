/* ═══ PUSH CLIENT ═══
   Browser-side helpers for Web Push: service worker registration, permission
   request, subscription create/delete, and test send.

   Imported by Settings.jsx for the opt-in flow. */

/* Public VAPID key — embedded in source because it's *meant* to be public. The
   private counterpart lives only in the server's environment variables. */
export const VAPID_PUBLIC_KEY = "BL-ZOFa-L0RCUYyzhvE0zTsYwzjZ6B45A2Y6MSdcORN-_BrSxM2P8y_LtsG-kLLXlNgQHlHwCZvwZxX9Ke6hf7w";

/* Convert a URL-safe base64 string into the Uint8Array form pushManager.subscribe expects. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* Whether Web Push works at all in this environment.
   iOS Safari only delivers push when the site has been installed to home screen. */
export function pushSupport() {
  if (typeof window === "undefined") return {ok: false, reason: "no window"};
  if (!("serviceWorker" in navigator)) return {ok: false, reason: "no service worker"};
  if (!("PushManager" in window)) return {ok: false, reason: "no PushManager"};
  if (!("Notification" in window)) return {ok: false, reason: "no Notification"};
  /* iOS: detect standalone (Add to Home Screen). Without this, iOS Safari blocks push. */
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  if (isIos && !isStandalone) return {ok: false, reason: "ios-requires-install", isIos: true};
  return {ok: true, isIos, isStandalone};
}

/* Register the service worker if not already. Safe to call repeatedly. */
export async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {scope: "/"});
    /* Wait for it to be active so subscribe() can succeed */
    if (reg.installing) {
      await new Promise(r => {
        const sw = reg.installing;
        sw.addEventListener("statechange", () => { if (sw.state === "activated") r(); });
      });
    }
    return reg;
  } catch (e) {
    console.error("[BCQ] SW register failed:", e);
    return null;
  }
}

/* Get the current push subscription if any. */
export async function getSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/* Subscribe to push and POST the result to our server. Returns the subscription on success. */
export async function subscribePush(userId) {
  const reg = await ensureServiceWorker();
  if (!reg) throw new Error("service worker unavailable");

  /* Permission */
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permission-denied");

  /* Subscribe (or reuse existing) */
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  /* Save to server */
  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      user_id: userId,
      subscription: sub.toJSON(),
      ua: navigator.userAgent,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`save failed: ${r.status} ${text.slice(0, 100)}`);
  }
  return sub;
}

/* Remove the subscription from this browser AND from the server. */
export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return true;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  try {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({endpoint}),
    });
  } catch {}
  return true;
}

/* Trigger a test push to verify the full pipeline works end-to-end. */
export async function sendTestPush(userId) {
  const r = await fetch("/api/push/test", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({user_id: userId}),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${r.status} ${text.slice(0, 150)}`);
  }
  return r.json();
}
