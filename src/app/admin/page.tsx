import Link from "next/link";
import { BarChart } from "@/components/charts/BarChart";
import { ChartFrame, EmptyChart } from "@/components/charts/ChartFrame";
import { DonutChart } from "@/components/charts/DonutChart";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { HBarChart } from "@/components/charts/HBarChart";
import { ChartLegend, LineChart } from "@/components/charts/LineChart";
import { colorAt, MUTED_FILL } from "@/components/charts/palette";
import { KpiCard } from "@/components/admin/KpiCard";
import { getDashboardData } from "@/lib/admin/analytics";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit";

export const metadata = { title: "Dashboard" };

/** ตัวเลขต้องสดเสมอ โดยเฉพาะวันงานที่ยอดเช็คอินขยับตลอดเวลา */
export const dynamic = "force-dynamic";

/** ย่อวันที่ 2026-03-14 ให้เหลือ 14/3 เพื่อไม่ให้ป้ายแกนล่างทับกัน */
function shortDay(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${Number(parts[2])}/${Number(parts[1])}` : iso;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  const event = await getAdminEvent(params.event);

  if (!event) {
    return (
      <p className="text-sm text-muted">
        ยังไม่มีงานในระบบ — สร้างงานแรกได้ที่หน้า{" "}
        <Link href="/admin/settings" className="text-primary-dark underline">
          ตั้งค่างาน
        </Link>
      </p>
    );
  }

  const data = await getDashboardData(event.id, { from: null, to: null });
  await recordAudit({ userId: user.id, action: "view_list", entityType: "dashboard", entityId: event.id });

  const notAttended = Math.max(data.kpi.totalRegistrations - data.kpi.checkedIn, 0);
  const regBase = "/admin/registrations";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted">ภาพรวมของงาน {event.nameTh}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/registrations"
            className="min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] border border-primary text-primary-dark text-sm font-semibold hover:bg-primary-light"
          >
            ดูรายชื่อผู้ลงทะเบียน
          </Link>
          <Link
            href="/admin/report"
            className="min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark"
          >
            รายงานสรุป (PDF)
          </Link>
        </div>
      </header>

      {/* ----- แถวบนสุด: ตัวเลขสรุป ----- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="ลงทะเบียนทั้งหมด" value={data.kpi.totalRegistrations} unit="คน" href={regBase} tone="primary" />
        <KpiCard label="เช็คอินแล้ว" value={data.kpi.checkedIn} unit="คน" href={`${regBase}?checkin=in`} />
        <KpiCard label="อัตราการมาจริง" value={data.kpi.showUpRate} unit="%" hint={`ยังไม่มา ${notAttended.toLocaleString("th-TH")} คน`} />
        <KpiCard label="ที่นั่งคงเหลือ" value={data.kpi.seatsRemaining} unit="ที่" hint="รวมทุกช่วงเวลา" />
        <KpiCard label="ลงทะเบียนหน้างาน" value={data.kpi.walkIn} unit="คน" href={`${regBase}?source=walkin`} />
        <KpiCard label="อีเมลส่งไม่สำเร็จ" value={data.kpi.failedEmails} unit="ฉบับ" tone="alert" href="/admin/emails?status=failed" hint={data.kpi.failedEmails > 0 ? "ต้องกดส่งซ้ำ" : undefined} />
      </div>

      {/* ----- กราฟ 11 ชุด ----- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartFrame no={1} title="ยอดลงทะเบียนสะสมรายวัน" question="โปรโมทวันไหนได้ผล ยอดพุ่งตอนโพสต์ลงช่องทางไหน" footer={<ChartLegend items={[{ name: "ยอดสะสม", color: colorAt(0) }, { name: "เฉพาะวันนั้น", color: colorAt(2) }]} />}>
          {data.daily.cumulative.length > 0 ? (
            <LineChart
              formatLabel={shortDay}
              series={[
                { name: "ยอดสะสม", points: data.daily.cumulative, color: colorAt(0) },
                { name: "เฉพาะวันนั้น", points: data.daily.daily, color: colorAt(2) },
              ]}
            />
          ) : (
            <EmptyChart hint="ยังไม่มีผู้ลงทะเบียน กราฟจะขึ้นทันทีที่มีคนแรกลงทะเบียน" />
          )}
        </ChartFrame>

        <ChartFrame no={2} title="อัตราการเข้าร่วมจริง (Show-up Rate)" question="คนลงทะเบียนแล้วมาจริงกี่เปอร์เซ็นต์ ครั้งหน้าควรเปิดรับเกินไว้เท่าไร">
          {data.kpi.totalRegistrations > 0 ? (
            <DonutChart
              centerValue={`${data.kpi.showUpRate}%`}
              centerLabel="มาจริง"
              items={[
                { label: "มาจริง", value: data.kpi.checkedIn, color: colorAt(0) },
                { label: "ยังไม่มา", value: notAttended, color: MUTED_FILL },
              ]}
            />
          ) : (
            <EmptyChart hint="ยังไม่มีผู้ลงทะเบียน" />
          )}
        </ChartFrame>

        <ChartFrame no={3} title="สัดส่วนผู้เข้าร่วม ภาคเช้า vs ภาคบ่าย" question="ควรเพิ่มโควตาช่วงไหนในครั้งหน้า" footer="แท่งจาง = ลงทะเบียน · แท่งเข้ม = เช็คอินแล้ว · คลิกที่แท่งเพื่อดูรายชื่อ">
          {data.sessions.length > 0 ? (
            <BarChart
              innerLabel="มา"
              groups={data.sessions.map((s) => ({
                label: s.name,
                value: s.registered,
                inner: s.checkedIn,
                href: `${regBase}?session=${s.id}`,
              }))}
            />
          ) : (
            <EmptyChart hint="ยังไม่ได้ตั้งช่วงเวลาของงาน" />
          )}
        </ChartFrame>

        <ChartFrame no={4} title="ช่องทางที่ทราบข้อมูลงาน" question="ควรทุ่มงบโฆษณาไปช่องทางไหน">
          {data.hearFrom.length > 0 ? (
            <HBarChart items={data.hearFrom} />
          ) : (
            <EmptyChart hint="ยังไม่มีคำตอบ — กราฟนี้มาจากคำถาม “ทราบข้อมูลงานจากช่องทางใด” ในฟอร์ม" />
          )}
        </ChartFrame>

        <ChartFrame no={5} title="รายการ TNN ที่ผู้ลงทะเบียนชื่นชอบ" question="กลุ่มผู้ชมของเราคือคนดูรายการอะไร">
          {data.programs.length > 0 ? (
            <HBarChart items={data.programs} />
          ) : (
            <EmptyChart hint="ยังไม่มีคำตอบ — กราฟนี้มาจากคำถามรายการ TNN ในฟอร์ม" />
          )}
        </ChartFrame>

        <ChartFrame no={6} title="สัดส่วนตามอาชีพ" question="ผู้เข้าร่วมเป็นกลุ่มอาชีพใดเป็นหลัก">
          {data.occupations.length > 0 ? (
            <DonutChart items={data.occupations} />
          ) : (
            <EmptyChart hint="ยังไม่มีผู้ลงทะเบียน" />
          )}
        </ChartFrame>

        <ChartFrame no={7} title="ช่วงเวลาที่คนเช็คอินหนาแน่นที่สุด" question="ครั้งหน้าควรเปิดจุดลงทะเบียนกี่จุด ช่วงเวลาไหน" footer="ชั่วโมงที่แท่งสูงที่สุดคือชั่วโมงที่ต้องเพิ่มเจ้าหน้าที่">
          {data.checkInHours.length > 0 ? (
            <BarChart barWidth={36} groups={data.checkInHours.map((h) => ({ label: h.label, value: h.value }))} />
          ) : (
            <EmptyChart hint="ยังไม่มีการเช็คอิน กราฟนี้จะขึ้นในวันงาน" />
          )}
        </ChartFrame>

        <ChartFrame no={8} title="ผลงานรายลิงก์" question="ลิงก์ไหนคุ้มที่สุด — คลิกเยอะไม่ได้แปลว่าลงทะเบียนเยอะ" footer={<Link href="/admin/links" className="text-primary-dark underline">จัดการลิงก์ติดตามผลทั้งหมด</Link>}>
          {data.links.length > 0 ? (
            <table className="w-full text-xs min-w-[440px]">
              <thead>
                <tr className="text-muted text-left border-b border-line">
                  <th className="py-1.5 font-medium">ลิงก์</th>
                  <th className="py-1.5 font-medium text-right">คลิก</th>
                  <th className="py-1.5 font-medium text-right">ลงทะเบียน</th>
                  <th className="py-1.5 font-medium text-right">อัตราแปลง</th>
                  <th className="py-1.5 font-medium text-right">มาจริง</th>
                </tr>
              </thead>
              <tbody>
                {data.links.map((link) => (
                  <tr key={link.id} className="border-b border-line last:border-0">
                    <td className="py-1.5">
                      <span className="text-ink">{link.label}</span>
                      <span className="text-muted ml-1">/r/{link.code}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{link.clicks}</td>
                    <td className="py-1.5 text-right tabular-nums">{link.conversions}</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-primary-dark">{link.conversionRate}%</td>
                    <td className="py-1.5 text-right tabular-nums">{link.attended}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyChart hint="ยังไม่ได้สร้างลิงก์ติดตามผล — ต้องสร้างก่อนเริ่มโปรโมท เพราะเก็บข้อมูลย้อนหลังไม่ได้" />
          )}
        </ChartFrame>

        <ChartFrame no={9} title="กรวยการแปลง (Conversion Funnel)" question="คนหลุดหายไปตรงขั้นไหนมากที่สุด">
          <FunnelChart steps={data.funnel} />
        </ChartFrame>

        <ChartFrame no={10} title="การแชร์แยกตามแพลตฟอร์ม" question="คนนิยมแชร์ผ่าน LINE หรือ Facebook">
          {data.shares.length > 0 ? (
            <DonutChart items={data.shares} />
          ) : (
            <EmptyChart hint="ยังไม่มีใครกดปุ่มแชร์" />
          )}
        </ChartFrame>

        <ChartFrame no={11} title="ยอดคลิกเทียบยอดลงทะเบียน รายวัน" question="โพสต์วันไหนได้ผลที่สุด ช่องว่างระหว่างสองเส้นคือคนที่กดเข้ามาแล้วไม่ลงทะเบียน" footer={<ChartLegend items={[{ name: "คลิกลิงก์", color: colorAt(2) }, { name: "ลงทะเบียนสำเร็จ", color: colorAt(0) }]} />}>
          {data.clicksVsRegs.length > 0 ? (
            <LineChart
              formatLabel={shortDay}
              series={[
                { name: "คลิกลิงก์", points: data.clicksVsRegs.map((d) => ({ label: d.label, value: d.a })), color: colorAt(2) },
                { name: "ลงทะเบียนสำเร็จ", points: data.clicksVsRegs.map((d) => ({ label: d.label, value: d.b })), color: colorAt(0) },
              ]}
            />
          ) : (
            <EmptyChart hint="ยังไม่มีข้อมูลการคลิกลิงก์" />
          )}
        </ChartFrame>
      </div>
    </div>
  );
}
