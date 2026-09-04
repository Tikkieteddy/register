/**
 * Service Worker สำหรับหน้าเจ้าหน้าที่
 *
 * หน้าที่เดียว: ทำให้หน้าสแกนเปิดได้แม้เน็ตหลุด
 * ข้อมูลผู้ลงทะเบียนไม่ได้อยู่ที่นี่ แต่อยู่ใน IndexedDB (src/lib/offline/db.ts)
 *
 * ⚠️ ไม่แคชคำขอที่ไม่ใช่ GET และไม่แคช server action เด็ดขาด
 *    ไม่งั้นการเช็คอินจะถูกตอบด้วยข้อมูลเก่าจากแคช
 */
const CACHE = "staff-shell-v1";
const SHELL = ["/staff", "/staff/search", "/staff/walkin", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // ถ้ามีบางไฟล์โหลดไม่ได้ ก็ยังติดตั้งต่อได้ ไม่ให้ทั้งชุดล้ม
      Promise.allSettled(SHELL.map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // POST คือการเช็คอินและ server action — ต้องถึงเซิร์ฟเวอร์จริงเสมอ ห้ามแตะ
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/staff") && !url.pathname.startsWith("/_next")) return;

  // network-first: ใช้ของสดก่อนเสมอ แล้วค่อยตกไปใช้แคชเมื่อเน็ตหลุด
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // ขอหน้าเว็บแต่ไม่มีในแคช — คืนหน้าสแกนที่แคชไว้แทนหน้า error ของเบราว์เซอร์
        if (request.mode === "navigate") {
          const fallback = await caches.match("/staff");
          if (fallback) return fallback;
        }
        return new Response("ออฟไลน์และไม่มีข้อมูลในแคช", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
