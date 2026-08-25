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
  /* 알림을 누르면 «그 알림이 가리키는 화면»으로 가야 한다.
     열린 창을 아무거나 앞으로 끌어오면 어느 모임 이야기였는지 알 수 없다 (2026-08-26). */
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async list => {
    const target = new URL(url, self.location.origin).href;
    for (const c of list) {                       /* ① 이미 그 화면이 열려 있으면 그 창으로 */
      if (c.url === target && 'focus' in c) return c.focus();
    }
    for (const c of list) {                       /* ② 다른 화면이 열려 있으면 그 창을 옮긴다 */
      if ('navigate' in c) { try { const n = await c.navigate(url); return (n || c).focus(); }catch(err){} }
    }
    return clients.openWindow(url);               /* ③ 창이 없거나 옮길 수 없으면 새로 */
  }));
});
