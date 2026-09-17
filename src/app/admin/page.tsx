import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/staff/LoginForm";
import { SiteCredit } from "@/components/site/SiteCredit";
import { Card, CardBody } from "@/components/ui/Card";
import { canOpenCms, canScan, getSession, type SessionUser } from "@/lib/auth/session";

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
   *   · ระบบจัดการงาน — ผู้ดูแลระบบและผู้จัดงาน
   *   · หน้าสแกนเช็คอิน — ทุกสิทธิ์ที่เปิดการสแกนไว้
   *
   * แสดงทั้งสองปุ่มเสมอ ปุ่มที่ไม่มีสิทธิ์จะเป็นสีเทาและกดไม่ได้ พร้อมบอกเหตุผล
   * เพื่อให้ทุกคนเห็นภาพรวมเหมือนกันว่าระบบมีกี่ส่วน และรู้ว่าตัวเองอยู่ตรงไหน
   */
  const cmsAllowed = canOpenCms(user);
  const scanAllowed = canScan(user);

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

      {!cmsAllowed && !scanAllowed ? (
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
          <AreaButton
            href="/admin-scan"
            icon="📷"
            title="สแกนเช็คอินหน้างาน"
            description="สแกน QR · ค้นหาชื่อ · ลงทะเบียนหน้างาน — ใช้ได้แม้เน็ตหลุด"
            primary
            lockedReason={
              scanAllowed ? undefined : "บัญชีนี้ถูกปิดสิทธิ์สแกน ติดต่อผู้ดูแลระบบเพื่อเปิดให้"
            }
          />
          <AreaButton
            href="/admin-cms"
            icon="⚙️"
            title="ระบบจัดการงาน"
            description="ตั้งค่างาน · รายชื่อผู้ลงทะเบียน · รายงาน · ส่งออกข้อมูล"
            primary={!scanAllowed}
            lockedReason={
              cmsAllowed
                ? undefined
                : "สิทธิ์เจ้าหน้าที่หน้างานใช้ได้เฉพาะระบบสแกน ติดต่อผู้ดูแลระบบหากต้องการสิทธิ์เพิ่ม"
            }
          />
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
    <div className="min-h-dvh flex flex-col bg-bg">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col gap-6">{children}</div>
      </main>
      <SiteCredit className="pb-6 px-4" />
    </div>
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
  lockedReason,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  primary?: boolean;
  /**
   * เหตุผลที่กดไม่ได้ — ใส่แล้วปุ่มจะเป็นสีเทาและกดไม่ได้ พร้อมแสดงเหตุผล
   *
   * ⚠️ แสดงปุ่มที่กดไม่ได้ ดีกว่าซ่อนปุ่มทิ้ง
   *    ถ้าซ่อน คนที่เคยได้ยินว่า "ระบบมีหลังบ้านด้วย" จะนึกว่าเว็บเสีย
   *    แล้วโทรถามผู้ดูแล การบอกตรง ๆ ว่าไม่มีสิทธิ์และให้ติดต่อใคร จบเรื่องได้เร็วกว่า
   */
  lockedReason?: string;
}) {
  const shell = `flex items-start gap-3 rounded-[var(--radius-card)] border p-4 text-start
    min-h-16`;

  if (lockedReason) {
    return (
      <div
        aria-disabled="true"
        className={`${shell} border-line bg-surface-2 opacity-70 cursor-not-allowed`}
      >
        <span aria-hidden="true" className="text-2xl leading-none mt-0.5 grayscale">
          {icon}
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-semibold text-ink-2">
            {title}
            <span className="ms-2 text-xs font-normal text-muted">🔒 ไม่มีสิทธิ์</span>
          </span>
          <span className="text-sm text-muted leading-snug">{lockedReason}</span>
        </span>
      </div>
    );
  }

  return (
    <a
      href={href}
      className={`${shell} transition-colors
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
