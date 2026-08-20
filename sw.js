/* 투넬 서비스 워커 — 푸시 수신 전용.
   캐시는 하지 않는다 — 정적 호스팅 + CDN이라 오프라인 캐시는 버그만 만든다. */

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (err) { d = { title: '투넬', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '투넬', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});
