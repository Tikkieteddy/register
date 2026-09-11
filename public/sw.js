/**
 * Service Worker สำหรับหน้าเจ้าหน้าที่
 *
 * หน้าที่เดียว: ทำให้หน้าสแกนเปิดได้แม้เน็ตหลุด
 * ข้อมูลผู้ลงทะเบียนไม่ได้อยู่ที่นี่ แต่อยู่ใน IndexedDB (src/lib/offline/db.ts)
 *
 * ⚠️ ไม่แคชคำขอที่ไม่ใช่ GET และไม่แคช server action เด็ดขาด
 *    ไม่งั้นการเช็คอินจะถูกตอบด้วยข้อมูลเก่าจากแคช
 */
const CACHE = "scan-shell-v3";

/**
 * ไฟล์ที่เก็บได้ตั้งแต่ตอนติดตั้ง — ต้องเป็นไฟล์ที่ไม่ต้องล็อกอินเท่านั้น
 *
 * ⚠️ ห้ามใส่หน้า /admin-scan ลงตรงนี้ และนี่คือเหตุผล
 *
 *    ตอน Service Worker ติดตั้ง ผู้ใช้มักยังอยู่หน้าล็อกอิน ยังไม่มีสิทธิ์เข้าหน้าเหล่านั้น
 *    เซิร์ฟเวอร์จึงตอบด้วยการส่งต่อไปหน้าล็อกอิน (redirect) ซึ่ง cache.add() ปฏิเสธ
 *    ตามมาตรฐานของเบราว์เซอร์ — เก็บไม่สำเร็จสักหน้า แล้วเงียบไปเลยเพราะใช้ allSettled
 *
 *    ผลคือเวลาเน็ตหลุดจริงหน้างาน เจ้าหน้าที่กดเมนูแล้วได้หน้าเปล่า
 *    หน้าที่ต้องล็อกอินจึงต้องเก็บหลังล็อกอินแทน (ดู warmUp ด้านล่าง)
 */
const PUBLIC_SHELL = ["/icon.svg", "/manifest.webmanifest"];

/** หน้าที่เจ้าหน้าที่ต้องใช้หน้างาน — เก็บหลังล็อกอินแล้วเท่านั้น */
const SCAN_PAGES = ["/admin-scan", "/admin-scan/search", "/admin-scan/walkin"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // ถ้ามีบางไฟล์โหลดไม่ได้ ก็ยังติดตั้งต่อได้ ไม่ให้ทั้งชุดล้ม
      Promise.allSettled(PUBLIC_SHELL.map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

/**
 * เก็บหน้าเจ้าหน้าที่ไว้ล่วงหน้า — หน้าเว็บสั่งมาหลังล็อกอินสำเร็จ
 *
 * ต้องทำตอนนี้เท่านั้น เพราะเป็นจังหวะเดียวที่ "ยังออนไลน์อยู่" และ
 * "มีสิทธิ์เข้าหน้าเหล่านั้นแล้ว" พร้อมกัน
 */
async function warmUp() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(
    SCAN_PAGES.map(async (url) => {
      const response = await fetch(url, { credentials: "same-origin" });
      // ถ้าถูกส่งต่อไปหน้าล็อกอิน แปลว่ายังไม่มีสิทธิ์ — อย่าเก็บหน้านั้นไว้
      // ไม่งั้นเวลาเน็ตหลุดจะได้หน้าล็อกอินแทนหน้าที่ต้องการ
      if (!response.ok || response.redirected) return;
      await cache.put(url, response);
    }),
  );
}

self.addEventListener("message", (event) => {
  if (event.data === "warm-up") event.waitUntil(warmUp());
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
  if (!url.pathname.startsWith("/admin-scan") && !url.pathname.startsWith("/_next")) return;

  // network-first: ใช้ของสดก่อนเสมอ แล้วค่อยตกไปใช้แคชเมื่อเน็ตหลุด
  event.respondWith(
    fetch(request)
      .then((response) => {
        // ⚠️ ห้ามเก็บหน้าที่ถูกส่งต่อไปหน้าล็อกอิน (redirected)
        //    ไม่งั้นพอเน็ตหลุด เจ้าหน้าที่จะได้หน้าล็อกอินแทนหน้าที่กด
        //    ทั้งที่ตัวเองล็อกอินอยู่แล้ว
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        /**
         * คำขอแบบ RSC (มี ?_rsc= ต่อท้าย) คือการเปลี่ยนหน้าแบบไม่โหลดใหม่ทั้งหน้า
         * ซึ่งเกิดตอนกดลิงก์ในเมนู — ที่อยู่ของมันไม่เหมือนที่อยู่ของหน้าปกติ
         * จึงหาในแคชไม่เจอ ต้องตอบว่าไม่สำเร็จเพื่อให้เบราว์เซอร์
         * ถอยไปโหลดทั้งหน้าแทน แล้วค่อยเจอหน้าที่เก็บไว้
         */
        if (url.searchParams.has("_rsc")) {
          return new Response("", { status: 503 });
        }
        // ขอหน้าเว็บแต่ไม่มีในแคช — คืนหน้าสแกนที่แคชไว้แทนหน้า error ของเบราว์เซอร์
        if (request.mode === "navigate") {
          const fallback = await caches.match("/admin-scan");
          if (fallback) return fallback;
        }
        return new Response("ออฟไลน์และไม่มีข้อมูลในแคช", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
