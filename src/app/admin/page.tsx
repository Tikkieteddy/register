import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/staff/LoginForm";
import { Card, CardBody } from "@/components/ui/Card";
import { canScan, getSession, isAdmin, type SessionUser } from "@/lib/auth/session";

/**
 * ทางเข้าเดียวของคนทำงานทั้งหมด — ทั้งเจ้าหน้าที่หน้างานและผู้ดูแลระบบ
 *
 * ทำไมรวมเป็นทางเข้าเดียว:
 *   เดิมมีสองทางเข้าแยกกัน คนจำผิดกันประจำว่าต้องเข้าทางไหน
 *   และผู้ดูแลที่ต้องทำทั้งสองอย่างต้องจำสองลิงก์
 *   ตอนนี้จำแค่ลิงก์เดียว แล้วระบบบอกเองว่าเข้าอะไรได้บ้าง
 *
 * หน้านี้ทำสองหน้าที่ในหน้าเดียว:
 *   ① ยังไม่ล็อกอิน → แสดงฟอร์มเข้าสู่ระบบ
 *   ② ล็อกอินแล้ว   → แสดงปุ่มเลือกทางเข้า ตามสิทธิ์ที่บัญชีนั้นมีจริง
 */

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

/**
 * ห้ามเก็บหน้านี้เป็นไฟล์นิ่ง เพราะเนื้อหาขึ้นกับว่าใครเปิดอยู่
 * ถ้าแคชไว้ คนที่ยังไม่ล็อกอินอาจเห็นหน้าของคนที่ล็อกอินแล้ว
 */
export const dynamic = "force-dynamic";

export default async function AdminEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; denied?: string }>;
}) {
  const { denied } = await searchParams;
  const session = await getSession();

  if (!session) return <SignInView />;
  return <ChooseAreaView user={session} denied={denied === "cms"} />;
}

/* ------------------------------------------------------------------ */
/* ① ยังไม่ล็อกอิน                                                      */
/* ------------------------------------------------------------------ */

function SignInView() {
  return (
    <Shell>
      <div className="text-center">
        <Logo />
        <h1 className="mt-3 text-xl font-semibold text-ink">เข้าสู่ระบบ</h1>
        <p className="text-sm text-muted mt-1">สำหรับเจ้าหน้าที่หน้างานและผู้ดูแลระบบ</p>
      </div>

      <Card>
        <CardBody>
          {/*
            กลับมาที่หน้านี้เสมอหลังล็อกอินสำเร็จ ไม่พาไปที่ไหนเอง
            เพราะบัญชีเดียวอาจเข้าได้สองส่วน ต้องให้เจ้าตัวเลือกเองว่าจะทำอะไร
          */}
          <LoginForm redirectTo="/admin" />
        </CardBody>
      </Card>

      <p className="text-xs text-muted text-center">
        ลืมรหัสผ่าน หรือบัญชีถูกล็อก กรุณาติดต่อผู้ดูแลระบบ
      </p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* ② ล็อกอินแล้ว — เลือกทางเข้า                                         */
/* ------------------------------------------------------------------ */

function ChooseAreaView({ user, denied }: { user: SessionUser; denied: boolean }) {
  /**
   * สิทธิ์ของสองส่วนแยกกันคนละเรื่อง ต้องตรวจแยกกัน
   *   · ระบบจัดการงาน — เฉพาะผู้ดูแลระบบ
   *   · หน้าสแกนเช็คอิน — เจ้าหน้าที่และผู้ดูแลที่เปิดสิทธิ์สแกนไว้
   *
   * ผู้ดูแลบางคนอาจถูกปิดสิทธิ์สแกนไว้ และเจ้าหน้าที่ก็เข้าระบบจัดการงานไม่ได้
   * จึงต้องแสดงเฉพาะปุ่มที่กดได้จริง ไม่ใช่แสดงทั้งสองปุ่มแล้วค่อยเด้งทีหลัง
   */
  const canOpenCms = isAdmin(user);
  const canOpenScan = canScan(user);

  return (
    <Shell>
      <div className="text-center">
        <Logo />
        <h1 className="mt-3 text-xl font-semibold text-ink">เลือกส่วนที่ต้องการใช้งาน</h1>
        <p className="text-sm text-ink-2 mt-1">
          เข้าสู่ระบบเป็น <span className="font-semibold text-ink">{user.fullName}</span>
        </p>
      </div>

      {denied && (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-[color:var(--color-danger-border)]
            bg-[color:var(--color-danger-bg)] px-4 py-3 text-sm text-ink-2"
        >
          บัญชีนี้ไม่มีสิทธิ์เข้าระบบจัดการงาน หากต้องการสิทธิ์เพิ่ม กรุณาติดต่อผู้ดูแลระบบ
        </p>
      )}

      {!canOpenCms && !canOpenScan ? (
        <Card>
          <CardBody>
            <p className="text-ink-2 text-sm leading-relaxed">
              บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งานส่วนใดเลย
              กรุณาติดต่อผู้ดูแลระบบเพื่อขอเปิดสิทธิ์
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {canOpenScan && (
            <AreaButton
              href="/admin-scan"
              icon="📷"
              title="สแกนเช็คอินหน้างาน"
              description="สแกน QR · ค้นหาชื่อ · ลงทะเบียนหน้างาน — ใช้ได้แม้เน็ตหลุด"
              primary
            />
          )}
          {canOpenCms && (
            <AreaButton
              href="/admin-cms"
              icon="⚙️"
              title="ระบบจัดการงาน"
              description="ตั้งค่างาน · รายชื่อผู้ลงทะเบียน · รายงาน · ส่งออกข้อมูล"
              primary={!canOpenScan}
            />
          )}
        </div>
      )}

      <p className="text-xs text-muted text-center">
        ไม่ใช่บัญชีของคุณ?{" "}
        <Link href="/" className="underline hover:text-primary-dark">
          กลับหน้าแรก
        </Link>
      </p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* ส่วนประกอบที่ใช้ร่วมกัน                                              */
/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-sm flex flex-col gap-6">{children}</div>
    </main>
  );
}

function Logo() {
  return (
    <div
      className="mx-auto size-14 rounded-[var(--radius-card)] bg-primary flex items-center justify-center text-2xl"
      aria-hidden="true"
    >
      🎫
    </div>
  );
}

/**
 * ปุ่มเลือกทางเข้า — ทำเป็นการ์ดกดได้ ไม่ใช่ปุ่มเล็ก เพราะต้องกดง่ายบนมือถือหน้างาน
 *
 * ⚠️ ต้องใช้ <a> ธรรมดา ห้ามใช้ <Link> ของ Next.js ตรงนี้ และนี่คือเหตุผล
 *
 *    <Link> เปลี่ยนหน้าโดยไม่โหลดใหม่ทั้งหน้า เอกสารที่เบราว์เซอร์ถืออยู่จึงยังเป็น
 *    ของหน้า /admin เดิม ซึ่งอยู่นอกขอบเขตที่ Service Worker ของหน้าสแกนดูแล (/admin-scan)
 *    ผลคือ Service Worker คุมหน้านั้นไม่ได้เลย (controller เป็น null)
 *    แล้วระบบทำงานตอนเน็ตหลุดก็ใช้ไม่ได้ทั้งหมด ทั้งที่ตัว Service Worker ทำงานปกติ
 *
 *    การโหลดใหม่ทั้งหน้าตรงนี้ไม่ได้ทำให้ช้าลงในทางที่รู้สึกได้ เพราะเป็นการ
 *    "เปลี่ยนพื้นที่ทำงาน" ที่เกิดครั้งเดียวตอนเริ่มงาน ไม่ใช่การกดไปมาบ่อย ๆ
 */
function AreaButton({
  href,
  icon,
  title,
  description,
  primary,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 text-start
        transition-colors min-h-16
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-[color:var(--color-primary)]
        ${
          primary
            ? "border-primary bg-primary-light hover:bg-[color:var(--color-primary-light)]"
            : "border-line bg-surface hover:border-primary"
        }`}
    >
      <span aria-hidden="true" className="text-2xl leading-none mt-0.5">
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-ink">{title}</span>
        <span className="text-sm text-ink-2 leading-snug">{description}</span>
      </span>
    </a>
  );
}
