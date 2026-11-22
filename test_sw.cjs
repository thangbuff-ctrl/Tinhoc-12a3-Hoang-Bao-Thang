const vm = require("vm");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const store = new Map();
const handlers = {};
const log = [];
const scope = "https://example.test/on-tap-tin-12/";
const origin = "https://example.test";

const cacheApi = {
  async open(name) {
    if (!store.has(name)) {
      const entries = new Map();
      store.set(name, entries);
      entries.addAll = async (urls) => {
        urls.forEach((url) => entries.set(url, new Response(`cached:${url}`)));
      };
      entries.match = async (request) => {
        const url = typeof request === "string" ? request : request.url;
        return entries.get(url) || null;
      };
      entries.put = async (request, response) => {
        const url = typeof request === "string" ? request : request.url;
        entries.set(url, response);
      };
    }
    return store.get(name);
  },
  async keys() { return [...store.keys()]; },
  async delete(name) { return store.delete(name); },
  async match(request) {
    const url = typeof request === "string" ? request : request.url;
    for (const entries of store.values()) {
      if (entries.has(url)) return entries.get(url);
    }
    return null;
  }
};

const self = {
  registration: { scope },
  location: { origin },
  clients: { async claim() { log.push("claimed"); } },
  async skipWaiting() { log.push("skipWaiting"); },
  addEventListener(name, callback) { handlers[name] = callback; }
};

let networkMode = "online";
const sandbox = {
  self,
  caches: cacheApi,
  URL,
  Request,
  Response,
  console: { warn() {}, log() {} },
  fetch: async (request) => {
    if (networkMode === "offline") throw new Error("offline");
    const response = new Response(`network:${request.url}`, { status: 200 });
    Object.defineProperty(response, "type", { value: "basic" });
    return response;
  }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "sw.js"), "utf8"), sandbox);

async function run() {
  // Old app cache and unrelated app cache should be treated differently.
  store.set("tin12-pwa-cache-v2", new Map());
  store.set("unrelated-app-cache", new Map());

  let installPromise;
  handlers.install({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;
  assert(store.has("tin12-pwa-cache-v3"));
  assert(log.includes("skipWaiting"));

  let activatePromise;
  handlers.activate({ waitUntil(promise) { activatePromise = promise; } });
  await activatePromise;
  assert(!store.has("tin12-pwa-cache-v2"));
  assert(store.has("unrelated-app-cache"));
  assert(log.includes("claimed"));

  let responsePromise;
  let waitPromise = Promise.resolve();
  const cachedRequest = new Request(`${scope}questions.json`);
  handlers.fetch({
    request: cachedRequest,
    respondWith(promise) { responsePromise = promise; },
    waitUntil(promise) { waitPromise = promise; }
  });
  const cachedResponse = await responsePromise;
  assert((await cachedResponse.text()).startsWith("cached:"));

  // Cache miss goes to network and writes successful same-origin GET.
  const networkRequest = new Request(`${scope}new-asset.js`);
  handlers.fetch({
    request: networkRequest,
    respondWith(promise) { responsePromise = promise; },
    waitUntil(promise) { waitPromise = promise; }
  });
  const networkResponse = await responsePromise;
  assert((await networkResponse.text()).startsWith("network:"));
  await waitPromise;
  const cache = await cacheApi.open("tin12-pwa-cache-v3");
  assert(await cache.match(networkRequest));

  // Offline navigation falls back to cached index.html.
  networkMode = "offline";
  const navRequest = { url: `${scope}some-route`, method: "GET", mode: "navigate" };
  handlers.fetch({
    request: navRequest,
    respondWith(promise) { responsePromise = promise; },
    waitUntil(promise) { waitPromise = promise; }
  });
  const offlineResponse = await responsePromise;
  assert((await offlineResponse.text()).startsWith("cached:"));

  // Non-GET and cross-origin requests are not intercepted.
  let intercepted = false;
  handlers.fetch({
    request: new Request(`${scope}submit`, { method: "POST", body: "x" }),
    respondWith() { intercepted = true; },
    waitUntil() {}
  });
  handlers.fetch({
    request: new Request("https://other.test/asset.js"),
    respondWith() { intercepted = true; },
    waitUntil() {}
  });
  assert.strictEqual(intercepted, false);

  console.log("PASS: install precache, activate cleanup scope, cache-first, network cache write, offline navigation fallback, POST/cross-origin bypass");
}
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
