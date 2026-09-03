# ระบบรับลงทะเบียนเข้าร่วมงาน (Event Registration System)

ระบบเว็บที่ดูแลผู้เข้าร่วมงานครบวงจร ตั้งแต่ฟอร์มลงทะเบียนออนไลน์และอีเมลยืนยันพร้อม QR Code
ไปจนถึงการสแกนเช็คอินหน้างานที่ทำงานได้แม้เน็ตหลุด และรายงานสรุปผลหลังจบงาน

> 📍 **สถานะปัจจุบัน: เฟส 1 — วางรากฐานโปรเจกต์ (เสร็จแล้ว)**
> เฟสถัดไปคือเฟส 2 — หน้ารายละเอียดงานและฟอร์มลงทะเบียน

---

## 📄 เอกสารประกอบ

| เอกสาร | เนื้อหา |
|---|---|
| [`docs/00-กระบวนการทำงานทั้งหมด.md`](docs/00-กระบวนการทำงานทั้งหมด.md) | เอกสารหลัก — workflow 40 ขั้นตอน · คู่มือผู้ใช้ 3 กลุ่ม · โครงสร้างข้อมูล 20 ตาราง · แผนงาน 8 เฟส |

---

## 🛠️ เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| Frontend + Backend | **Next.js 15** (App Router) + TypeScript | ภาษาเดียวทั้งระบบ พัฒนาเร็ว หาคนดูแลต่อง่าย |
| สไตล์ | **Tailwind CSS v4** + CSS Variables | เปลี่ยนธีมได้จากที่เดียว |
| ฐานข้อมูล | **PostgreSQL** (Supabase · region Singapore) | รองรับ transaction + row lock สำหรับตัดโควตาที่นั่ง |
| ORM | **Drizzle ORM** + drizzle-kit | type-safe และ migration ตรงไปตรงมา |
| ตรวจสอบข้อมูล | **Zod** | ใช้กฎเดียวกันทั้งฝั่ง client และ server |
| ฟอนต์ | IBM Plex Sans Thai + Sarabun | รองรับภาษาไทย อ่านง่าย self-host ผ่าน `next/font` |
| Hosting | Vercel (`sin1`) + Cloudflare + Resend | auto-scale ตอน spike · latency ต่ำสำหรับผู้ใช้ในไทย |

---

## 🚀 วิธีติดตั้งและรัน

### สิ่งที่ต้องมีก่อน
- **Node.js 22** ขึ้นไป ([ดาวน์โหลด](https://nodejs.org))
- ฐานข้อมูล **PostgreSQL** — แนะนำสมัคร [Supabase](https://supabase.com) ฟรี แล้ว**เลือก region Singapore**

### ขั้นตอน

```bash
# 1. ดึงโค้ดลงเครื่อง
git clone https://github.com/Tikkieteddy/register.git
cd register

# 2. ติดตั้ง dependencies
npm install

# 3. คัดลอกไฟล์ตั้งค่า แล้วเปิดแก้ค่าจริง
cp .env.example .env.local        # Windows PowerShell: Copy-Item .env.example .env.local

# 4. สร้างตารางในฐานข้อมูล
npm run db:migrate

# 5. ใส่ข้อมูลตัวอย่างสำหรับทดสอบ
npm run db:seed

# 6. เริ่มเซิร์ฟเวอร์
npm run dev
```

เปิดเบราว์เซอร์ที่ **http://localhost:3000**

> 💡 **บน Windows:** ถ้า path มีเว้นวรรค (เช่น `ai project`) ต้องใส่เครื่องหมายคำพูดครอบเสมอ
> เช่น `cd "C:\Users\TIKKIE\Desktop\ai project\register"`

---

## ⚙️ การตั้งค่า Environment Variables

ดูคำอธิบายทุกตัวแปรพร้อมวิธีหาค่าได้ในไฟล์ [`.env.example`](.env.example)

| ตัวแปร | จำเป็นเมื่อไร | คำอธิบายสั้น |
|---|---|---|
| `DATABASE_URL` | **ตั้งแต่แรก** | Connection string ของ PostgreSQL |
| `NEXT_PUBLIC_SITE_URL` | **ตั้งแต่แรก** | URL เต็มของเว็บ ใช้สร้างลิงก์ในอีเมลและ QR |
| `HASH_SALT` | ก่อนขึ้น production | ใช้แฮช IP ก่อนบันทึก — **ห้ามเก็บ IP ดิบตาม PDPA** |
| `RESEND_API_KEY` · `EMAIL_FROM` | เฟส 3 | ส่งอีเมลยืนยันพร้อม QR |
| `RECAPTCHA_SECRET_KEY` · `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | เฟส 2 | ป้องกัน bot ที่หน้าฟอร์ม |

> ⚠️ **ห้าม commit ไฟล์ `.env` หรือ `.env.local` เข้า git เด็ดขาด** — `.gitignore` กันไว้ให้แล้ว

---

## 📜 คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เริ่มเซิร์ฟเวอร์สำหรับพัฒนา |
| `npm run build` | build สำหรับขึ้น production |
| `npm run start` | รันเวอร์ชัน production ที่ build แล้ว |
| `npm run typecheck` | ตรวจชนิดข้อมูลด้วย TypeScript |
| `npm run lint` | ตรวจคุณภาพโค้ดด้วย ESLint |
| `npm run db:generate` | สร้างไฟล์ migration จาก schema ที่แก้ไข |
| `npm run db:migrate` | รัน migration ที่ยังไม่ได้รันเข้าฐานข้อมูล |
| `npm run db:push` | ดันโครงสร้างเข้าฐานข้อมูลตรง ๆ (**ใช้เฉพาะตอนพัฒนา**) |
| `npm run db:studio` | เปิดหน้าเว็บดูและแก้ข้อมูลในฐานข้อมูล |
| `npm run db:seed` | ใส่ข้อมูลตัวอย่างสำหรับทดสอบ |

---

## 📁 โครงสร้างโปรเจกต์

```
register/
├── docs/                    เอกสารกระบวนการทำงาน
├── drizzle/                 ไฟล์ migration SQL (สร้างอัตโนมัติ ห้ามแก้ด้วยมือ)
├── public/                  ไฟล์สาธารณะ เช่น รูปภาพ
├── src/
│   ├── app/                 หน้าเว็บและ API (Next.js App Router)
│   │   ├── globals.css      Design Token — สีธีมและตัวแปรทั้งหมดอยู่ที่นี่
│   │   ├── layout.tsx       โครงหลักของทุกหน้า + ฟอนต์ไทย
│   │   └── page.tsx         หน้าแรก
│   ├── db/
│   │   ├── schema/          โครงสร้างฐานข้อมูล 20 ตาราง
│   │   ├── index.ts         การเชื่อมต่อฐานข้อมูล
│   │   └── seed.ts          ข้อมูลตัวอย่าง
│   ├── lib/
│   │   ├── env.ts           ตรวจสอบ environment variables
│   │   ├── quota.ts         ⭐ ตรรกะตัดโควตาที่นั่ง (จุดสำคัญที่สุดของระบบ)
│   │   ├── hash.ts          แฮช IP ก่อนบันทึกตามข้อกำหนด PDPA
│   │   └── codes.ts         สร้างรหัสผู้ลงทะเบียนและโค้ดตั๋ว
│   └── types/               ประกาศชนิดข้อมูลเพิ่มเติม
├── .env.example             ตัวอย่างการตั้งค่า
└── .github/workflows/ci.yml ตรวจโค้ดอัตโนมัติทุกครั้งที่ push
```

---

## 🗄️ ฐานข้อมูล 20 ตาราง

| กลุ่ม | ตาราง |
|---|---|
| **งานและฟอร์ม** | `events` · `event_sessions` · `form_questions` · `form_options` · `settings` |
| **ผู้ลงทะเบียน** | `registrations` · `registration_sessions` · `registration_answers` · `seat_holds` · `consents` |
| **ตั๋วและเช็คอิน** | `tickets` · `check_ins` · `badge_prints` |
| **ผู้ใช้ระบบ** | `users` |
| **ภาพและการตลาด** | `media_assets` · `share_links` · `link_events` |
| **ระบบเบื้องหลัง** | `email_logs` · `audit_logs` · `calendar_syncs` |

### ⚠️ 3 จุดที่ต้องระวังเป็นพิเศษเวลาแก้โค้ด

1. **การตัดโควตาที่นั่ง** (`src/lib/quota.ts`)
   ต้องทำใน transaction พร้อม `SELECT ... FOR UPDATE` เสมอ
   ถ้าเขียนแบบอ่านมาบวกแล้วเขียนกลับธรรมดา จะรับลงทะเบียนเกินโควตาตอนคนกดพร้อมกัน

2. **QR token** (`tickets.qrToken`)
   ต้องเป็น UUID สุ่มเท่านั้น **ห้ามใส่ชื่อ อีเมล หรือเบอร์โทรลงใน QR โดยตรง**
   และต้องตรวจสอบฝั่งเซิร์ฟเวอร์ทุกครั้ง ห้ามเชื่อข้อมูลจากฝั่ง client

3. **IP address** (`ipHash` · `visitorHash`)
   ต้องผ่าน `hashIdentifier()` ใน `src/lib/hash.ts` ก่อนบันทึกเสมอ
   **ห้ามเขียน IP ดิบลงฐานข้อมูล** ตามข้อกำหนด PDPA

---

## 🎨 สีธีมและ Design Token

สีทั้งหมดถูกกำหนดเป็น CSS Variables ที่ [`src/app/globals.css`](src/app/globals.css)
**ห้าม hard-code ค่าสีกระจายทั่วโค้ด** ให้เรียกใช้ผ่านตัวแปรเสมอ เพื่อให้เปลี่ยนธีมได้จากที่เดียว

| ตัวแปร | ค่า | ใช้กับ |
|---|---|---|
| `--color-primary` | `#EC5F27` | ปุ่มหลัก · หัวข้อสำคัญ · ลิงก์ · กราฟ |
| `--color-primary-dark` | `#C94A18` | hover / active |
| `--color-primary-light` | `#FFF1EA` | พื้นหลังอ่อน |
| `--color-primary-contrast` | `#FFFFFF` | ตัวอักษรบนพื้นสีหลัก |
| `--color-danger` | `#D32F2F` | ข้อความ error — **ตั้งใจแยกจากสีส้ม CI ไม่ให้ปนกัน** |

---

## ✅ การตรวจสอบคุณภาพ

ทุกครั้งที่ push ขึ้น GitHub ระบบจะรันอัตโนมัติ ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

1. ตรวจชนิดข้อมูลด้วย TypeScript
2. ตรวจคุณภาพโค้ดด้วย ESLint
3. ตรวจช่องโหว่ความปลอดภัยของ dependencies (`npm audit`)
4. Build จริง

รันเองก่อน commit ได้ด้วย:

```bash
npm run typecheck && npm run lint && npm run build
```

---

## 🗺️ แผนการทำงาน

| เฟส | ชื่อ | สถานะ |
|---|---|---|
| 0 | เอกสารกระบวนการทำงาน | ✅ เสร็จ |
| **1** | **วางรากฐานโปรเจกต์** | ✅ **เสร็จ** |
| 2 | หน้า Public + ฟอร์มลงทะเบียน | ⏭️ ถัดไป |
| 3 | QR + อีเมล + หน้าเสร็จสิ้น | ⏳ รอ |
| 4 | ระบบหน้างาน (Staff PWA) | ⏳ รอ |
| 5 | ระบบหลังบ้าน (Admin) | ⏳ รอ |
| 6 | ความปลอดภัยและ PDPA | ⏳ รอ |
| 7 | ทดสอบ · Deploy · ส่งมอบ | ⏳ รอ |
