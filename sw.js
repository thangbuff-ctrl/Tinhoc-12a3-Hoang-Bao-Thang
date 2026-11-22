/* Service Worker Tin học 12 PWA – cache versioned and scoped */
const CACHE_NAME = "tin12-pwa-cache-v4";
const APP_SCOPE_URL = new URL("./", self.registration.scope);
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./questions.json",
  "./Noi_Dung_De_Thi_26_Cau.txt",
  "./manifest.json"
].map((path) => new URL(path, APP_SCOPE_URL).href);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cài đặt chỉ thành công khi toàn bộ tài nguyên thiết yếu được precache.
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const oldAppCaches = cacheNames.filter((name) =>
      name.startsWith("tin12-pwa-cache-") && name !== CACHE_NAME
    );
    await Promise.all(oldAppCaches.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (!requestUrl.pathname.startsWith(APP_SCOPE_URL.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.ok && networkResponse.type === "basic") {
        try {
          await cache.put(request, networkResponse.clone());
        } catch (cacheError) {
          console.warn("[Tin12 PWA] Không thể lưu cache:", cacheError);
        }
      }
      return networkResponse;
    } catch (error) {
      if (request.mode === "navigate") {
        const offlinePage = await cache.match(new URL("index.html", APP_SCOPE_URL).href);
        if (offlinePage) return offlinePage;
      }
      return new Response("Tài nguyên này chưa được lưu để sử dụng ngoại tuyến.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
