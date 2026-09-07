import Link from "next/link";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { HBarChart } from "@/components/charts/HBarChart";
import { LineChart } from "@/components/charts/LineChart";
import { colorAt, MUTED_FILL } from "@/components/charts/palette";
import { PrintButton } from "@/components/admin/PrintButton";
import { getDashboardData } from "@/lib/admin/analytics";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit";
import { formatDateRange, formatThaiDate, formatTime } from "@/lib/datetime";

export const metadata = { title: "รายงานสรุป" };
export const dynamic = "force-dynamic";

function shortDay(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${Number(parts[2])}/${Number(parts[1])}` : iso;
}

function Block({
  no,
  title,
  children,
}: {
  no: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid border border-line rounded-[var(--radius-card)] p-4 flex flex-col gap-3 bg-surface">
      <h2 className="text-sm font-semibold text-ink">
        <span className="text-primary-dark">{no}.</span> {title}
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/**
 * รายงานสรุปสำหรับส่งผู้บริหาร (หัวข้อ 3.4)
 *
 * ออกแบบให้พิมพ์ลงกระดาษ A4 ได้ทันทีจากเบราว์เซอร์
 * แถบเมนูและปุ่มถูกซ่อนตอนพิมพ์ด้วย print:hidden
 */
export default async function ReportPage() {
  const admin = await requireAdmin();
  const event = await getAdminEvent();
  if (!event) return <p className="text-sm text-muted">ยังไม่มีงานในระบบ</p>;

  const data = await getDashboardData(event.id, { from: null, to: null });
  const now = new Date();

  await recordAudit({
    userId: admin.id,
    action: "export",
    entityType: "report",
    entityId: event.id,
    after: { format: "pdf-print", totalRegistrations: data.kpi.totalRegistrations },
  });

  const notAttended = Math.max(data.kpi.totalRegistrations - data.kpi.checkedIn, 0);

  const kpis = [
    ["ลงทะเบียนทั้งหมด", `${data.kpi.totalRegistrations.toLocaleString("th-TH")} คน`],
    ["เช็คอินแล้ว", `${data.kpi.checkedIn.toLocaleString("th-TH")} คน`],
    ["อัตราการมาจริง", `${data.kpi.showUpRate}%`],
    ["ที่นั่งคงเหลือ", `${data.kpi.seatsRemaining.toLocaleString("th-TH")} ที่`],
    ["ลงทะเบียนหน้างาน", `${data.kpi.walkIn.toLocaleString("th-TH")} คน`],
    ["ยกเลิก", `${data.kpi.cancelled.toLocaleString("th-TH")} คน`],
  ] as const;

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <nav className="text-sm print:hidden">
        <Link href="/admin" className="text-primary-dark hover:underline">
          ← กลับไป Dashboard
        </Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-xs text-muted">รายงานสรุปผลการลงทะเบียน</p>
          <h1 className="text-xl font-bold text-ink">{event.nameTh}</h1>
          <p className="text-sm text-muted">
            {formatDateRange(event.startsAt, event.endsAt)}
            {event.venueName ? ` · ${event.venueName}` : ""}
          </p>
          <p className="text-xs text-muted tabular-nums">
            ออกรายงานเมื่อ {formatThaiDate(now)} {formatTime(now)} น. โดย {admin.fullName}
          </p>
        </div>
        <PrintButton />
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 break-inside-avoid">
        {kpis.map(([label, value]) => (
          <div key={label} className="border border-line rounded-[var(--radius-card)] px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-xl font-bold text-ink tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <Block no={1} title="ยอดลงทะเบียนสะสมรายวัน">
        {data.daily.cumulative.length > 0 ? (
          <LineChart
            formatLabel={shortDay}
            series={[{ name: "ยอดสะสม", points: data.daily.cumulative, color: colorAt(0) }]}
          />
        ) : (
          <p className="text-sm text-muted">ยังไม่มีข้อมูล</p>
        )}
      </Block>

      <Block no={2} title="อัตราการเข้าร่วมจริง">
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
          <p className="text-sm text-muted">ยังไม่มีข้อมูล</p>
        )}
      </Block>

      <Block no={3} title="สัดส่วนผู้เข้าร่วมแต่ละช่วงเวลา">
        <BarChart
          innerLabel="มา"
          groups={data.sessions.map((s) => ({
            label: s.name,
            value: s.registered,
            inner: s.checkedIn,
          }))}
        />
      </Block>

      <Block no={4} title="ช่องทางที่ทราบข้อมูลงาน">
        {data.hearFrom.length > 0 ? (
          <HBarChart items={data.hearFrom} maxRows={8} />
        ) : (
          <p className="text-sm text-muted">ยังไม่มีข้อมูล</p>
        )}
      </Block>

      <Block no={5} title="รายการ TNN ที่ผู้ลงทะเบียนชื่นชอบ">
        {data.programs.length > 0 ? (
          <HBarChart items={data.programs} maxRows={8} />
        ) : (
          <p className="text-sm text-muted">ยังไม่มีข้อมูล</p>
        )}
      </Block>

      <Block no={6} title="สัดส่วนตามอาชีพ">
        {data.occupations.length > 0 ? (
          <DonutChart items={data.occupations} />
        ) : (
          <p className="text-sm text-muted">ยังไม่มีข้อมูล</p>
        )}
      </Block>

      <Block no={7} title="ช่วงเวลาที่คนเช็คอินหนาแน่นที่สุด">
        {data.checkInHours.length > 0 ? (
          <BarChart barWidth={36} groups={data.checkInHours.map((h) => ({ label: h.label, value: h.value }))} />
        ) : (
          <p className="text-sm text-muted">ยังไม่มีการเช็คอิน</p>
        )}
      </Block>

      <Block no={8} title="ผลงานรายลิงก์ประชาสัมพันธ์">
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
                  <td className="py-1.5">{link.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{link.clicks}</td>
                  <td className="py-1.5 text-right tabular-nums">{link.conversions}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">
                    {link.conversionRate}%
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{link.attended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">ยังไม่มีลิงก์ติดตามผล</p>
        )}
      </Block>

      <Block no={9} title="กรวยการแปลง">
        <FunnelChart steps={data.funnel} />
      </Block>

      <p className="text-xs text-muted border-t border-line pt-3">
        รายงานนี้สร้างจากข้อมูลในระบบ ณ เวลาที่ระบุด้านบน · มีข้อมูลเชิงสถิติเท่านั้น
        ไม่มีข้อมูลส่วนบุคคลของผู้ลงทะเบียน จึงส่งต่อภายในองค์กรได้
      </p>
    </div>
  );
}
