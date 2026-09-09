# คู่มือ Deploy ขึ้นเครื่องจริง

> **ระบบรับลงทะเบียนเข้าร่วมงาน (Event Registration System) — TNN**
> Vercel (region `sin1` สิงคโปร์) + Supabase (Singapore) + Cloudflare R2 + Resend
> เวอร์ชัน 1.0 · ใช้กับโค้ดตั้งแต่เฟส 5 เป็นต้นไป

---

## ภาพรวม — ต้องสมัคร 4 บริการ

| บริการ | ใช้ทำอะไร | แพ็กเกจที่ใช้ก่อน | ต้องมีก่อน |
|---|---|---|---|
| **Vercel** | รันเว็บทั้งหมด | Hobby (ฟรี) | ขั้นตอนที่ 2 |
| **Supabase** | ฐานข้อมูล PostgreSQL | Free | ขั้นตอนที่ 1 |
| **Resend** | ส่งอีเมลยืนยันพร้อม QR | Free (3,000 ฉบับ/เดือน) | ขั้นตอนที่ 5 |
| **Cloudflare R2** | เก็บไฟล์ภาพ | Free (10 GB) | ขั้นตอนที่ 6 |

> ### ⚠️ เรื่องที่ต้องรู้ก่อนเริ่ม
>
> **1. Vercel แพ็กเกจ Hobby ห้ามใช้เชิงพาณิชย์**
> ใช้ทดสอบภายในและทำ UAT ได้ แต่**ก่อนเปิดรับลงทะเบียนจริงต้องอัปเป็น Pro** (20 USD/เดือน)
> ไม่งั้นเสี่ยงถูกระงับบัญชีกลางงาน
>
> **2. โดเมนต้องเป็น HTTPS**
> กล้องสแกน QR และระบบทำงานตอนเน็ตหลุด (Service Worker) ใช้ได้เฉพาะ HTTPS เท่านั้น
> Vercel ให้ HTTPS มาอยู่แล้วทั้งโดเมนแจกและโดเมนของตัวเอง
>
> **3. อีเมลจะตกถัง Junk ถ้าตั้ง DNS ไม่ครบ**
> ต้องตั้ง SPF + DKIM + DMARC ให้ครบก่อนเปิดรับจริง — ดูขั้นตอนที่ 5

---

## ขั้นตอนที่ 1 · สร้างฐานข้อมูลบน Supabase

1. เข้า [supabase.com](https://supabase.com) → **New project**
2. ตั้งค่า:
   - **Name:** `tnn-event-register`
   - **Database Password:** กดสุ่มแล้ว**เก็บไว้ให้ดี** (ใช้ใน connection string)
   - **Region:** ⚠️ ต้องเลือก **Southeast Asia (Singapore)** — ใกล้ผู้ใช้ไทยที่สุด
3. รอสร้างเสร็จ (~2 นาที)
4. กดปุ่ม **Connect** สีเขียวด้านบนของหน้า Dashboard (ข้าง ๆ ชื่อโปรเจกต์)
5. ในหน้าต่างที่เด้งขึ้นมา เลือกแท็บ **ORMs** แล้วจะเห็นกล่องโค้ดที่มี 2 บรรทัดนี้:

```bash
DATABASE_URL="postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

กดปุ่มคัดลอกมุมขวาบนของกล่องโค้ด แล้วแทนที่ `[YOUR-PASSWORD]` ด้วยรหัสผ่านจากข้อ 2

> **ไม่ต้องสนใจขั้นตอนอื่นในหน้านั้น** — หน้านี้เขียนไว้สำหรับ Prisma แต่โปรเจกต์เราใช้ Drizzle
> เอาแค่ 2 บรรทัดนี้พอ **ห้ามรัน `npm install prisma`**

**แต่ละเส้นใช้ตอนไหน:**

| ตัวแปร | พอร์ต | ใช้ทำอะไร | ใส่ใน Vercel ไหม |
|---|---|---|---|
| `DATABASE_URL` | 6543 | ตัวเว็บใช้ตอนทำงานจริง | ✅ ต้องใส่ |
| `DIRECT_URL` | 5432 | ใช้เฉพาะตอนรัน migration จากเครื่องตัวเอง | ❌ ไม่ต้องใส่ |

> **ทำไมตัวเว็บต้องใช้พอร์ต 6543:** Vercel รันแบบ serverless ซึ่งเปิดการเชื่อมต่อใหม่บ่อยมาก
> ถ้าต่อตรงพอร์ต 5432 จะเต็มโควตาการเชื่อมต่อแล้วเว็บล่มตอนคนเข้าพร้อมกัน
>
> **ทำไม migration ต้องใช้พอร์ต 5432:** คำสั่งสร้างตาราง (DDL) ต้องใช้การต่อแบบ session mode
> ถ้ารันผ่าน pooler จะล้มกลางคัน

### สร้างตารางในฐานข้อมูล

รันจากเครื่องของคุณ (ทำครั้งเดียว):

```bash
git clone https://github.com/Tikkieteddy/register.git
cd register
npm install

# สร้างไฟล์ .env.local แล้ววาง 2 บรรทัดจากข้อ 5 ลงไป (แทนที่ [YOUR-PASSWORD] แล้ว)
#   DATABASE_URL="postgresql://postgres.xxxxx:รหัสผ่าน@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
#   DIRECT_URL="postgresql://postgres.xxxxx:รหัสผ่าน@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

npm run db:migrate     # สร้าง 20 ตาราง (ใช้ DIRECT_URL อัตโนมัติ)
npm run db:seed        # ใส่งานตัวอย่าง ช่วงเวลา คำถาม ลิงก์ และบัญชีผู้ใช้
```

> ทุกสคริปต์อ่านค่าจาก `.env.local` ให้เองอัตโนมัติ ไม่ต้องตั้งตัวแปรแวดล้อมก่อนรัน

**ตั้งรหัสผ่านบัญชีผู้ดูแล** (ไม่ทำข้อนี้จะเข้าหลังบ้านไม่ได้):

```bash
npm run user:password -- admin@example.com "รหัสผ่านที่ปลอดภัยอย่างน้อย10ตัว"
npm run user:password -- staff@example.com "รหัสผ่านของเจ้าหน้าที่"
```

---

## ขั้นตอนที่ 2 · เชื่อม GitHub กับ Vercel

1. เข้า [vercel.com](https://vercel.com) → เข้าสู่ระบบด้วยบัญชี GitHub เดียวกับที่เก็บโค้ด
2. **Add New… → Project**
3. เลือก repository **`Tikkieteddy/register`** → **Import**
4. หน้า Configure Project:
   - **Framework Preset:** Next.js (ระบบตรวจให้เองอยู่แล้ว)
   - **Root Directory:** `./`
   - **Build Command / Output Directory:** ปล่อยค่าเริ่มต้น
   - **⚠️ ยังไม่ต้องกด Deploy** — ใส่ Environment Variables ให้ครบก่อน (ขั้นตอนที่ 3)

> **Region:** ไม่ต้องตั้งเอง ไฟล์ [`vercel.json`](../vercel.json) ในโปรเจกต์กำหนด `sin1` (สิงคโปร์) ไว้ให้แล้ว

### เลือก branch ที่จะ deploy

โค้ดตอนนี้อยู่บน branch `claude/event-registration-step-0-i9ulcz`
ไปที่ **Settings → Git → Production Branch** แล้วตั้งเป็น branch นี้
(หรือ merge เข้า `main` ก่อนแล้วใช้ `main` ตามปกติ)

---

## ขั้นตอนที่ 3 · ใส่ Environment Variables

ไปที่ **Settings → Environment Variables** แล้วใส่ทีละตัว
เลือก scope ให้ครบทั้ง **Production · Preview · Development**

### ตัวที่ขาดไม่ได้ (ไม่มีแล้วเว็บทำงานไม่ได้)

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | เส้น Transaction pooler **พอร์ต 6543** จากขั้นตอนที่ 1 (⚠️ ไม่ใช่ `DIRECT_URL`) |
| `NEXT_PUBLIC_SITE_URL` | URL เต็มของเว็บ เช่น `https://register.tnn.co.th` — ⚠️ **ห้ามมี `/` ปิดท้าย** |
| `HASH_SALT` | ค่าสุ่ม 64 ตัวอักษร (ดูวิธีสร้างด้านล่าง) |
| `SESSION_SECRET` | ค่าสุ่ม 64 ตัวอักษร (ดูวิธีสร้างด้านล่าง) |

**วิธีสร้างค่าสุ่ม** — รันบนเครื่องคุณเอง:

```bash
node -e "console.log('HASH_SALT='+require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET='+require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('CRON_SECRET='+require('crypto').randomBytes(24).toString('hex'))"
```

> ### ⚠️ ห้ามเปลี่ยนค่า 2 ตัวนี้หลังเปิดใช้งานจริง
> - **`HASH_SALT`** — เปลี่ยนแล้วสถิติ "ผู้เข้าชมไม่ซ้ำ" จะนับใหม่ทั้งหมด เทียบย้อนหลังไม่ได้อีก
> - **`SESSION_SECRET`** — เปลี่ยนแล้วทุกคนที่ล็อกอินอยู่หลุดออกทันที **ห้ามเปลี่ยนระหว่างวันงานเด็ดขาด**

### ตัวที่ต้องมีก่อนเปิดรับลงทะเบียนจริง

| ตัวแปร | ได้จากไหน | ไม่มีแล้วเป็นอย่างไร |
|---|---|---|
| `RESEND_API_KEY` | ขั้นตอนที่ 5 | ผู้ลงทะเบียนไม่ได้รับอีเมลและ QR |
| `EMAIL_FROM` | ขั้นตอนที่ 5 | เหมือนข้างบน |
| `R2_ACCOUNT_ID` | ขั้นตอนที่ 6 | **ภาพที่อัปโหลดหายทุกครั้งที่ deploy** |
| `R2_BUCKET` | ขั้นตอนที่ 6 | เหมือนข้างบน |
| `R2_ACCESS_KEY_ID` | ขั้นตอนที่ 6 | เหมือนข้างบน |
| `R2_SECRET_ACCESS_KEY` | ขั้นตอนที่ 6 | เหมือนข้างบน |
| `R2_PUBLIC_BASE_URL` | ขั้นตอนที่ 6 | เหมือนข้างบน |
| `CRON_SECRET` | สร้างเอง (คำสั่งด้านบน) | งานกวาดที่นั่งค้างรายวันไม่ทำงาน (ไม่กระทบการตัดโควตา) |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | [reCAPTCHA admin](https://www.google.com/recaptcha/admin) | ระบบข้ามการตรวจ bot |
| `RECAPTCHA_SECRET_KEY` | เหมือนข้างบน | เหมือนข้างบน |

---

## ขั้นตอนที่ 4 · Deploy ครั้งแรก

กด **Deploy** แล้วรอประมาณ 2–3 นาที

เสร็จแล้วเปิด URL ที่ Vercel ให้มา (เช่น `register-xxxx.vercel.app`) แล้วตรวจ:

| ตรวจอะไร | URL | ควรเห็นอะไร |
|---|---|---|
| หน้าแรก | `/` | เปลี่ยนเส้นทางไปหน้ารายละเอียดงาน |
| หน้างาน | `/e/tnn-event-2026` | ชื่องาน · ที่นั่งคงเหลือ · ปุ่มลงทะเบียน |
| ฟอร์ม | กดปุ่มลงทะเบียน | ฟอร์มขึ้นครบ และ URL **ต้องยังมี `ref` และ `utm_*` ติดไปด้วย** |
| หลังบ้าน | `/admin` | เด้งไปหน้าล็อกอิน แล้วล็อกอินด้วยบัญชี admin ได้ |
| เจ้าหน้าที่ | `/staff` | เด้งไปหน้าล็อกอิน แล้วเข้าหน้าสแกนได้ |

**ถ้า deploy ไม่ผ่าน:** เปิดแท็บ **Deployments → เลือกรอบที่ล้ม → Build Logs**
สาเหตุที่พบบ่อยคือ `DATABASE_URL` พิมพ์ผิดหรือลืมใส่รหัสผ่านลงใน connection string

### ตรวจความพร้อมด้วยคำสั่งเดียว

รันจากเครื่องคุณ โดยใช้ค่าเดียวกับที่ใส่ใน Vercel:

```bash
npm run check:deploy
```

สคริปต์จะตรวจ environment variables ครบไหม · ต่อฐานข้อมูลได้ไหม · migration ครบ 20 ตารางหรือยัง ·
มีบัญชีผู้ดูแลที่ตั้งรหัสผ่านแล้วหรือยัง แล้วบอกทีละข้อว่าต้องแก้อะไร

---

## ขั้นตอนที่ 5 · ตั้งค่าอีเมล (Resend)

> **ข้อนี้สำคัญที่สุดของทั้งการ deploy** — ถ้าตั้ง DNS ไม่ครบ อีเมลจะตกถัง Junk ทั้งหมด
> และผู้ลงทะเบียนจะไม่ได้รับ QR สำหรับเข้างาน

1. สมัคร [resend.com](https://resend.com)
2. **Domains → Add Domain** → ใส่โดเมนที่จะใช้ส่ง เช่น `tnn.co.th`
3. Resend จะแสดงระเบียน DNS ที่ต้องเพิ่ม — **ส่งให้ทีม IT ไปวางในระบบ DNS ของโดเมน**

| ชนิด | ใช้ทำอะไร | ไม่มีแล้วเป็นอย่างไร |
|---|---|---|
| **SPF** (TXT) | บอกว่า Resend มีสิทธิ์ส่งแทนโดเมนนี้ | Gmail และ Outlook ตีกลับหรือโยนเข้า Junk |
| **DKIM** (TXT/CNAME) | ลายเซ็นดิจิทัลของอีเมล | เหมือนข้างบน |
| **DMARC** (TXT) | บอกว่าให้ทำอย่างไรถ้าตรวจไม่ผ่าน | คะแนนความน่าเชื่อถือต่ำ ตกถัง Junk ง่าย |

4. รอ DNS มีผล (ปกติ 15 นาที – 2 ชั่วโมง) แล้วกด **Verify** ในหน้า Resend จนขึ้นสถานะเขียวครบทุกข้อ
5. **API Keys → Create API Key** → คัดลอกไปใส่ `RESEND_API_KEY` ใน Vercel
6. ตั้ง `EMAIL_FROM` เป็นรูปแบบ `TNN Event <noreply@tnn.co.th>` — ⚠️ ต้องเป็นโดเมนที่ยืนยันแล้วเท่านั้น

### ทดสอบทันทีหลังตั้งเสร็จ

เข้าหลังบ้าน → **จัดการอีเมล** → กด **ส่งทดสอบ** หาอีเมลตัวเอง
แล้วเช็ก **ทั้งกล่องจดหมายหลักและถัง Junk** ของทั้ง Gmail · Outlook · Apple Mail

> ถ้าอีเมลไปอยู่ใน Junk แปลว่า DNS ยังไม่ครบหรือยังไม่มีผล **ห้ามเปิดรับลงทะเบียนจริงจนกว่าจะแก้ได้**

---

## ขั้นตอนที่ 6 · ตั้งค่าที่เก็บภาพ (Cloudflare R2)

> **ทำไมต้องมี:** ระบบไฟล์ของ Vercel เขียนไม่ได้และหายทุกครั้งที่ deploy
> ถ้าไม่ตั้ง R2 ภาพโลโก้และโปสเตอร์ที่อัปโหลดไว้จะหายไปทันทีที่ deploy รอบถัดไป

1. เข้า [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 → Create bucket**
   - **ชื่อ:** `tnn-event-media`
   - **Location:** Asia-Pacific
2. เข้า bucket → **Settings → Public access → Connect Custom Domain**
   ผูกโดเมนย่อย เช่น `img.tnn.co.th` (แนะนำ) หรือเปิด **R2.dev subdomain** ไปก่อนสำหรับทดสอบ
3. กลับหน้า R2 → **Manage R2 API Tokens → Create API Token**
   - **Permissions:** `Object Read & Write`
   - **Bucket:** เลือกเฉพาะ bucket ที่สร้างไว้ (อย่าให้สิทธิ์ทุก bucket)
4. คัดลอกค่าไปใส่ใน Vercel:

| ตัวแปรใน Vercel | เอาค่ามาจาก |
|---|---|
| `R2_ACCOUNT_ID` | Account ID บนหน้า R2 (สตริง 32 ตัวอักษร) |
| `R2_BUCKET` | ชื่อ bucket เช่น `tnn-event-media` |
| `R2_ACCESS_KEY_ID` | Access Key ID จาก API Token |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key จาก API Token (**แสดงครั้งเดียว เก็บไว้ทันที**) |
| `R2_PUBLIC_BASE_URL` | โดเมนสาธารณะจากข้อ 2 เช่น `https://img.tnn.co.th` |

5. Redeploy แล้วเข้าหลังบ้าน → **ภาพและสื่อ** → อัปโหลดโลโก้ทดสอบ 1 ไฟล์
   ด้านล่างหน้าจอต้องขึ้นว่า **ที่เก็บไฟล์ที่ใช้อยู่: cloudflare-r2**

---

## ขั้นตอนที่ 7 · ผูกโดเมนจริง

1. Vercel → **Settings → Domains → Add** → ใส่โดเมน เช่น `register.tnn.co.th`
2. Vercel จะบอกระเบียน DNS ที่ต้องเพิ่ม (ปกติเป็น `CNAME` ชี้ไป `cname.vercel-dns.com`)
3. ให้ทีม IT วางระเบียนนั้น แล้วรอจนขึ้นสถานะ **Valid Configuration**
4. **⚠️ อย่าลืม** กลับไปแก้ `NEXT_PUBLIC_SITE_URL` ให้เป็นโดเมนจริง แล้ว **Redeploy**

> ถ้าลืมข้อ 4 ลิงก์ในอีเมลและ QR ทั้งหมดจะยังชี้ไปที่ URL เก่าของ Vercel
> ตั๋วที่ส่งออกไปแล้วจะแก้ไม่ได้

---

## ขั้นตอนที่ 8 · ก่อนเปิดรับลงทะเบียนจริง

| # | สิ่งที่ต้องทำ | ทำไม |
|---|---|---|
| 1 | **อัป Vercel เป็นแพ็กเกจ Pro** | Hobby ห้ามใช้เชิงพาณิชย์ — เสี่ยงถูกระงับกลางงาน |
| 2 | **ล้างข้อมูลทดสอบทั้งหมด** | ข้อมูลสมมติห้ามปนกับผู้ลงทะเบียนจริง |
| 3 | **เปลี่ยนรหัสผ่านบัญชีตัวอย่าง** | `admin@example.com` และ `staff@example.com` เป็นอีเมลที่เดาได้ |
| 4 | **ทำ UAT ให้ครบ** | ดู [`docs/UAT-checklist.md`](UAT-checklist.md) — ข้อ 🔴 ต้องผ่านครบ 100% |
| 5 | **ตั้งงานจริงในหน้าตั้งค่า** | ชื่องาน · วันเวลา · สถานที่ · จำนวนที่นั่ง · คำถามในฟอร์ม |
| 6 | **สร้างลิงก์ติดตามผลก่อนเริ่มโปรโมท** | ⚠️ ยอดคลิกและที่มาของผู้ลงทะเบียน**เก็บย้อนหลังไม่ได้** |
| 7 | **เปลี่ยนสถานะงานเป็น “เผยแพร่แล้ว”** | ถ้ายังเป็นฉบับร่าง คนทั่วไปจะเข้าหน้าลงทะเบียนไม่ได้ |

**คำสั่งล้างข้อมูลทดสอบ** (รันกับฐานข้อมูล production ด้วยความระมัดระวัง):

```sql
TRUNCATE TABLE check_ins, badge_prints, tickets, registration_answers,
               registration_sessions, consents, email_logs, seat_holds,
               calendar_syncs, link_events, registrations
RESTART IDENTITY CASCADE;

UPDATE event_sessions SET reserved_count = 0, checked_in_count = 0;
UPDATE share_links SET click_count = 0, unique_count = 0, conversion_count = 0;
```

---

## ขั้นตอนที่ 9 · หลัง deploy — สิ่งที่ควรเฝ้าดู

| ดูที่ไหน | ดูอะไร |
|---|---|
| Vercel → **Logs** | error ที่เกิดจริงตอนคนใช้งาน |
| Supabase → **Database → Reports** | จำนวน connection — ถ้าใกล้เต็มแปลว่าต้องใช้ pooler หรืออัปแพ็กเกจ |
| หลังบ้าน → **จัดการอีเมล** | อีเมลที่ส่งไม่สำเร็จ ต้องกดส่งซ้ำ |
| หลังบ้าน → **Dashboard** | ที่นั่งคงเหลือ · ยอดลงทะเบียน · อัตราแปลงรายลิงก์ |
| หลังบ้าน → **บันทึกการใช้งาน** | ใครเข้าถึงหรือส่งออกข้อมูลส่วนบุคคลบ้าง (ข้อกำหนด PDPA) |

### การ deploy ครั้งถัดไป

Vercel จะ deploy อัตโนมัติทุกครั้งที่ push ขึ้น branch ที่ตั้งเป็น Production Branch
ไม่ต้องทำอะไรเพิ่ม

**ถ้ามีการแก้โครงสร้างฐานข้อมูล** ต้องรัน migration เองก่อนหรือหลัง deploy:

```bash
npm run db:migrate
```

---

## ปัญหาที่เจอบ่อยและวิธีแก้

| อาการ | สาเหตุที่พบบ่อยที่สุด | วิธีแก้ |
|---|---|---|
| Build ล้มที่ Vercel | `DATABASE_URL` ผิด หรือลืมใส่รหัสผ่าน | ดู Build Logs แล้วแก้ค่าใน Environment Variables |
| เปิดเว็บแล้วขึ้น 500 | ยังไม่ได้รัน migration | รัน `npm run db:migrate` |
| ล็อกอินไม่ได้เลย | ยังไม่ได้ตั้ง `SESSION_SECRET` หรือยังไม่ได้ตั้งรหัสผ่านบัญชี | ตั้ง env แล้วรัน `npm run user:password` |
| กล้องสแกนไม่ขึ้น | เข้าผ่าน http ไม่ใช่ https | ใช้โดเมน HTTPS เสมอ |
| อีเมลไม่ถึง หรือตกถัง Junk | SPF / DKIM / DMARC ยังไม่ครบ | กลับไปทำขั้นตอนที่ 5 ให้ครบ |
| ภาพที่อัปโหลดหายหลัง deploy | ยังไม่ได้ตั้งค่า R2 | ทำขั้นตอนที่ 6 |
| ลิงก์ในอีเมลชี้ไป URL เก่า | ลืมแก้ `NEXT_PUBLIC_SITE_URL` หลังผูกโดเมน | แก้แล้ว Redeploy |
| ฐานข้อมูล connection เต็ม | ใส่ `DIRECT_URL` (5432) ลงใน Vercel แทน `DATABASE_URL` (6543) | เปลี่ยนเป็นเส้น Transaction pooler |
| `db:migrate` ล้มกลางคัน | รัน migration ผ่าน pooler พอร์ต 6543 | ใส่ `DIRECT_URL` ลงใน `.env.local` ด้วย |

---

## เอกสารที่เกี่ยวข้อง

- [`README.md`](../README.md) — วิธีติดตั้งและรัน · จุดที่ต้องระวังเวลาแก้โค้ด
- [`docs/UAT-checklist.md`](UAT-checklist.md) — เช็กลิสต์ทดสอบ 177 ข้อ ต้องทำก่อนเปิดใช้จริง
- [`docs/00-กระบวนการทำงานทั้งหมด.md`](00-กระบวนการทำงานทั้งหมด.md) — เอกสารหลักของระบบ
- [`.env.example`](../.env.example) — รายการ environment variables ทั้งหมดพร้อมคำอธิบาย
