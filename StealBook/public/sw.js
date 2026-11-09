// Steal Book 서비스 워커 — 홈 화면 설치와 공유 메뉴 연결을 위해 필요합니다.
// 화면 파일은 항상 최신을 먼저 받고(네트워크 우선), 인터넷이 끊겼을 때만 저장해 둔 것을 씁니다.
// 데이터(Supabase)와 /api 요청은 건드리지 않습니다.
const CACHE = 'stealbook-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? '/' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then((r) => r || Response.error())),
  );
});
