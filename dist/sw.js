/* ═══ BCQ SERVICE WORKER ═══
   Receives Web Push messages from the server and displays notifications.
   Required for iOS Web Push (Apple only delivers to PWAs installed to home screen).

   This file is served from /sw.js — registered by the main app on first load.
   The browser/OS keeps it alive in the background between page loads. */

/* ── INSTALL: claim activation immediately so updates take effect on next page load ── */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ── PUSH: server sent a payload, show a notification ──
   Payload structure (JSON in event.data):
     { title, body, tag, peptideId, dueLabel, url }
   - tag is used so repeated pushes for the same peptide replace each other instead of stacking
   - url is opened when the user taps the notification */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {title: "Body Comp HQ", body: event.data ? event.data.text() : "Reminder"};
  }
  const title = data.title || "Body Comp HQ";
  const options = {
    body: data.body || "Peptide reminder",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "bcq-reminder",
    data: {url: data.url || "/", peptideId: data.peptideId},
    requireInteraction: false,
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* ── NOTIFICATION CLICK: focus an existing tab or open one ── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.focus();
          if ("navigate" in w) w.navigate(targetUrl).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

/* ── PUSH SUBSCRIPTION CHANGE: re-subscribe and re-register with the server ──
   Browsers occasionally rotate push subscriptions. When that happens, we need to
   re-register or notifications silently stop working. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
        });
        // Notify the app the next time a window is open so it can re-save to DB
        const clients = await self.clients.matchAll({type: "window", includeUncontrolled: true});
        clients.forEach((c) => c.postMessage({type: "subscription-changed", subscription: sub.toJSON()}));
      } catch (e) {
        console.error("[BCQ sw] pushsubscriptionchange failed:", e);
      }
    })()
  );
});
