const CACHE_NAME = "famat-__FAMAT_BUILD__";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/images/placeholder.svg",
  "/higia-192.png",
  "/higia-512.png",
  "/favicon.png"
];

const NETWORK_FIRST_FILES = ["/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "actualizar") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.endsWith("/version.json")) {
    return;
  }

  if (
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.includes("vite")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((res) => res || caches.match("/index.html")))
    );
    return;
  }

  // La app nueva tiene que entrar sin quedar pegada a un JS viejo.
  if (
    NETWORK_FIRST_FILES.some((path) => url.pathname.endsWith(path))
    || url.pathname.startsWith("/assets/")
    || url.pathname.endsWith(".js")
    || url.pathname.endsWith(".css")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first para imágenes y resto del mismo origen (incluye images/productos/*).
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => {
            if (url.pathname.includes("/images/productos/")) {
              return caches.match("/images/placeholder.svg");
            }
            return caches.match(request);
          })
      );
    })
  );
});
