import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCheckInStatsAction } from "@/app/actions/checkin";
import { ScanScreen } from "@/components/staff/ScanScreen";
import { canScan, getSession } from "@/lib/auth/session";
import { getActiveEventSlug } from "@/lib/staff-event";

export const metadata: Metadata = { title: "สแกน QR — เจ้าหน้าที่" };

export default async function StaffScanPage() {
  const session = await getSession();
  if (!session) redirect("/staff/login?next=/staff");
  if (!canScan(session)) redirect("/staff/login?next=/staff");

  const slug = await getActiveEventSlug();
  if (!slug) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-ink-2">ยังไม่มีงานที่เปิดใช้งานอยู่ กรุณาติดต่อผู้ดูแลระบบ</p>
      </main>
    );
  }

  const stats = await getCheckInStatsAction(slug);

  return <ScanScreen eventSlug={slug} staffName={session.fullName} initialStats={stats} />;
}
