const CACHE_NAME = "hydropop-shell-v1";
const OFFLINE_URL = "/offline";
const SAFE_TARGET = "/today?record=1&source=push";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll([
          OFFLINE_URL,
          "/icons/hydropop-icon-192.png",
          "/icons/hydropop-badge-96.png",
        ]),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

function parseNotification(event) {
  try {
    const value = event.data?.json();
    const validPace =
      value?.kind === "pace-reminder" &&
      value.target === SAFE_TARGET &&
      value.tag === "hydropop-pace";
    const validTest =
      value?.kind === "test" &&
      value.target === "/today" &&
      /^hydropop-test-[0-9a-f-]{36}$/.test(value.tag);
    if (
      value?.version !== 1 ||
      typeof value.title !== "string" ||
      typeof value.body !== "string" ||
      value.title.length < 1 ||
      value.title.length > 80 ||
      value.body.length < 1 ||
      value.body.length > 180 ||
      (!validPace && !validTest)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const notification = parseNotification(event);
  if (!notification) return;

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      badge: "/icons/hydropop-badge-96.png",
      data: { target: notification.target },
      icon: "/icons/hydropop-icon-192.png",
      tag: notification.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedTarget = event.notification.data?.target;
  const target =
    requestedTarget === SAFE_TARGET || requestedTarget === "/today"
      ? requestedTarget
      : "/today";
  const targetUrl = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            await client.focus();
            return client.navigate(targetUrl);
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
