import type { Metadata } from "next";
import { MemberSignUpForm } from "@/components/member/MemberSignUpForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { getFeaturedEvent } from "@/db/queries";
import { isStorageConfigured } from "@/lib/storage";

/**
 * หน้าสมัครสมาชิกสำหรับผู้เข้าร่วมงาน
 *
 * ⚠️ ไม่ใช่หน้าเข้าสู่ระบบ และไม่ใช่ทางเข้าหลังบ้าน
 *    สมาชิกไม่มีรหัสผ่านและเข้าหลังบ้านไม่ได้ — ข้อมูลนี้มีไว้กรอกครั้งเดียว
 *    แล้วใช้ซ้ำตอนสมัครเข้าร่วมงานแต่ละงาน จะได้ไม่ต้องพิมพ์ใหม่ทุกครั้ง
 */

const SITE_NAME = "ระบบรับลงทะเบียนเข้าร่วมงาน";

export const metadata: Metadata = {
  title: "สมัครสมาชิก",
  description:
    "สมัครสมาชิกไว้ล่วงหน้า เพื่อไม่ต้องกรอกข้อมูลซ้ำทุกครั้งที่สมัครเข้าร่วมงาน",
};

/** เมนูดึงชื่องานที่เปิดรับอยู่จากฐานข้อมูล จึงเก็บหน้านี้เป็นไฟล์นิ่งไม่ได้ */
export const dynamic = "force-dynamic";

export default async function MemberSignUpPage() {
  const [featured, photoUploadReady] = await Promise.all([
    getFeaturedEvent(),
    Promise.resolve(isStorageConfigured()),
  ]);

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <SiteHeader siteName={SITE_NAME} eventSlug={featured?.slug} />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-ink text-balance tracking-tight">
            สมัครสมาชิก
          </h1>
          <p className="text-ink-2 max-w-[58ch] text-[15px] leading-relaxed">
            กรอกข้อมูลไว้ครั้งเดียว แล้วใช้ซ้ำได้ทุกงาน
            ครั้งหน้าที่สมัครเข้าร่วมงานจะไม่ต้องพิมพ์ข้อมูลเดิมใหม่ทั้งหมด
          </p>
        </header>

        <Card>
          <CardBody>
            <MemberSignUpForm photoUploadReady={photoUploadReady} />
          </CardBody>
        </Card>

        <p className="text-sm text-muted">
          ช่องที่มีเครื่องหมาย <span className="text-primary">*</span> จำเป็นต้องกรอก
          ที่เหลือกรอกเพิ่มภายหลังได้
        </p>
      </main>

      <SiteFooter siteName={SITE_NAME} eventSlug={featured?.slug} />
    </div>
  );
}
