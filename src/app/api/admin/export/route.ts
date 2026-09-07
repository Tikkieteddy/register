import { NextResponse, type NextRequest } from "next/server";
import { getAdminEvent } from "@/lib/admin/current-event";
import { getAdminOrNull } from "@/lib/admin/guard";
import { toCsv, toXlsx, type ExportColumn } from "@/lib/admin/export";
import {
  getAnswersForExport,
  listRegistrationsForExport,
  type RegistrationFilter,
} from "@/lib/admin/registrations";
import { recordAudit } from "@/lib/audit";
import { formatThaiDate, formatTime } from "@/lib/datetime";

/**
 * ส่งออกรายชื่อผู้ลงทะเบียน (หัวข้อ 3.4)
 *
 * ⚠️ ข้อกำหนด PDPA — ทุกครั้งที่มีการ export ต้องบันทึกไว้ว่า
 *    ใคร ดึงอะไรออกไป เมื่อไร กี่รายการ ก่อนส่งไฟล์กลับเสมอ
 */

const STATUS_LABEL: Record<string, string> = {
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิก",
  waitlist: "รายชื่อสำรอง",
  no_show: "ไม่มางาน",
};

const SOURCE_LABEL: Record<string, string> = {
  online: "ลงทะเบียนออนไลน์",
  walkin: "ลงทะเบียนหน้างาน",
  admin_manual: "ผู้ดูแลเพิ่มให้",
};

const EMAIL_LABEL: Record<string, string> = {
  sent: "ส่งสำเร็จ",
  queued: "รอส่ง",
  failed: "ส่งไม่สำเร็จ",
  bounced: "ตีกลับ",
  complained: "ถูกร้องเรียน",
};

/**
 * งานสร้างไฟล์ของงานใหญ่ (หลายพันแถว) ใช้เวลานานกว่าค่าเริ่มต้นของ Vercel
 * 60 วินาทีเป็นเพดานสูงสุดของแพ็กเกจฟรี
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์ใช้งานส่วนนี้" }, { status: 403 });
  }

  const url = request.nextUrl.searchParams;
  const event = await getAdminEvent(url.get("event") ?? undefined);
  if (!event) {
    return NextResponse.json({ ok: false, message: "ไม่พบงาน" }, { status: 404 });
  }

  const format = url.get("format") === "csv" ? "csv" : "xlsx";

  const filter: RegistrationFilter = {
    q: url.get("q") ?? undefined,
    checkin: url.get("checkin") ?? undefined,
    sessionId: url.get("session") ?? undefined,
    emailStatus: url.get("email") ?? undefined,
    source: url.get("source") ?? undefined,
    occupation: url.get("occupation") ?? undefined,
    from: url.get("from") ?? undefined,
    to: url.get("to") ?? undefined,
  };

  const all = await listRegistrationsForExport(event.id, filter);

  // ถ้าเลือกรายการไว้บนหน้าจอ ให้ export เฉพาะที่เลือก
  const selectedIds = url.getAll("id");
  const items = selectedIds.length > 0 ? all.filter((r) => selectedIds.includes(r.id)) : all;

  const extra = await getAnswersForExport(event.id);

  const columns: ExportColumn[] = [
    { header: "รหัสลงทะเบียน", width: 16 },
    { header: "ชื่อ", width: 18 },
    { header: "นามสกุล", width: 18 },
    { header: "อีเมล", width: 30 },
    { header: "เบอร์โทรศัพท์", width: 16 },
    { header: "อาชีพ", width: 20 },
    { header: "ช่วงเวลาที่เลือก", width: 24 },
    { header: "สถานะ", width: 12 },
    { header: "เช็คอิน", width: 12 },
    { header: "แหล่งที่มา", width: 18 },
    { header: "ลิงก์ที่พามา", width: 22 },
    { header: "สถานะอีเมล", width: 14 },
    { header: "วันเวลาที่ลงทะเบียน", width: 22 },
    ...extra.questions.map((q) => ({ header: q.label, width: 26 })),
  ];

  const rows = items.map((item) => [
    item.registrationCode,
    item.firstName,
    item.lastName,
    item.email,
    // ส่งเบอร์เป็นข้อความเสมอ ไม่ใช่ตัวเลข ไม่งั้น Excel จะตัดเลข 0 ตัวหน้าทิ้ง
    item.phone,
    item.occupation ?? "",
    item.sessionNames ?? "",
    STATUS_LABEL[item.status] ?? item.status,
    item.checkedInCount > 0 ? "เช็คอินแล้ว" : "ยังไม่มา",
    SOURCE_LABEL[item.source] ?? item.source,
    item.shareLinkLabel ?? "",
    item.emailStatus ? (EMAIL_LABEL[item.emailStatus] ?? item.emailStatus) : "ยังไม่ส่ง",
    `${formatThaiDate(item.createdAt)} ${formatTime(item.createdAt)}`,
    ...extra.questions.map((q) => extra.valueFor(item.id, q.id)),
  ]);

  await recordAudit({
    userId: admin.id,
    action: "export",
    entityType: "registration",
    entityId: event.id,
    after: { format, rowCount: rows.length, filter, selectedOnly: selectedIds.length > 0 },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `รายชื่อผู้ลงทะเบียน-${event.slug}-${stamp}`;
  // ชื่อไฟล์ภาษาไทยต้องส่งผ่าน filename* แบบ RFC 5987 ไม่งั้นเบราว์เซอร์บางตัวจะได้ชื่อเพี้ยน
  const encodedName = encodeURIComponent(`${baseName}.${format}`);

  const body =
    format === "csv"
      ? toCsv(columns, rows)
      : toXlsx("ผู้ลงทะเบียน", columns, rows);

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="export-${stamp}.${format}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
