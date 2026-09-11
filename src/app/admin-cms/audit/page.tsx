import Link from "next/link";
import { sql } from "drizzle-orm";
import { Pagination } from "@/components/admin/Pagination";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/guard";
import { formatThaiDate, formatTime } from "@/lib/datetime";

export const metadata = { title: "บันทึกการใช้งาน" };
export const dynamic = "force-dynamic";

/**
 * บันทึกการเข้าถึงและแก้ไขข้อมูล (หัวข้อ 3.7)
 *
 * ⚠️ หน้านี้ต้องอ่านได้อย่างเดียวเสมอ ห้ามมีปุ่มลบหรือแก้ไข
 *    audit log ที่แก้ได้ไม่มีค่าทางกฎหมาย
 */
const ACTION_LABEL: Record<string, string> = {
  login: "เข้าสู่ระบบ",
  logout: "ออกจากระบบ",
  login_failed_password: "เข้าสู่ระบบไม่สำเร็จ (รหัสผ่านผิด)",
  login_failed_unknown_email: "เข้าสู่ระบบไม่สำเร็จ (ไม่พบอีเมล)",
  login_failed_locked: "เข้าสู่ระบบไม่สำเร็จ (บัญชีถูกล็อก)",
  login_failed_inactive: "เข้าสู่ระบบไม่สำเร็จ (บัญชีถูกระงับ)",
  view_list: "เปิดดูรายชื่อ",
  view_detail: "เปิดดูข้อมูลรายบุคคล",
  export: "ส่งออกข้อมูล",
  create: "สร้างรายการใหม่",
  update: "แก้ไขข้อมูล",
  cancel: "ยกเลิกการลงทะเบียน",
  delete: "ลบข้อมูล",
  anonymize: "ลบข้อมูลส่วนบุคคลตามคำขอ PDPA",
  resend_email: "ส่งอีเมลซ้ำ",
  test_email: "ส่งอีเมลทดสอบ",
  upload_media: "อัปโหลดภาพ",
  delete_media: "นำภาพออก",
  create_link: "สร้างลิงก์ติดตามผล",
  update_link: "แก้ไขลิงก์ติดตามผล",
  update_settings: "แก้ไขการตั้งค่า",
  create_user: "สร้างบัญชีผู้ใช้",
  update_user: "แก้ไขบัญชีผู้ใช้",
  reset_password: "ตั้งรหัสผ่านใหม่ให้ผู้ใช้",
};

/** การกระทำที่ควรตรวจเป็นพิเศษเวลาทบทวนย้อนหลัง */
const SENSITIVE = new Set(["export", "anonymize", "delete", "reset_password", "create_user"]);

const PER_PAGE = 60;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const actionFilter = params.action;

  const rows = await db.execute<{
    id: number;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    after_json: unknown;
    created_at: Date;
    user_name: string | null;
    user_email: string | null;
  }>(sql`
    select al.id, al.action, al.entity_type, al.entity_id, al.after_json, al.created_at,
           u.full_name as user_name, u.email as user_email
    from audit_logs al
    left join users u on u.id = al.user_id
    ${actionFilter ? sql`where al.action = ${actionFilter}` : sql``}
    order by al.created_at desc
    limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}
  `);

  const [countRow] = await db.execute<{ total: number }>(sql`
    select count(*)::int as total from audit_logs al
    ${actionFilter ? sql`where al.action = ${actionFilter}` : sql``}
  `);

  const total = Number(countRow?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const actions = await db.execute<{ action: string; count: number }>(sql`
    select action, count(*)::int as count from audit_logs group by 1 order by count desc limit 12
  `);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink">บันทึกการใช้งาน (Audit Log)</h1>
        <p className="text-sm text-muted">
          ใคร เข้าถึง แก้ไข หรือส่งออกข้อมูลอะไร เมื่อไร — เก็บไว้ตามข้อกำหนด PDPA และแก้ไขไม่ได้
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin-cms/audit"
          className={`min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] text-sm border ${
            !actionFilter
              ? "border-primary bg-primary-light text-primary-dark font-semibold"
              : "border-line text-ink-2 hover:bg-surface-2"
          }`}
        >
          ทั้งหมด <span className="tabular-nums ml-1.5 text-xs">{total}</span>
        </Link>
        {actions.map((row) => (
          <Link
            key={row.action}
            href={`/admin-cms/audit?action=${row.action}`}
            className={`min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] text-sm border ${
              actionFilter === row.action
                ? "border-primary bg-primary-light text-primary-dark font-semibold"
                : "border-line text-ink-2 hover:bg-surface-2"
            }`}
          >
            {ACTION_LABEL[row.action] ?? row.action}
            <span className="tabular-nums ml-1.5 text-xs">{row.count}</span>
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto border border-line rounded-[var(--radius-card)] bg-surface">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">เวลา</th>
              <th className="p-3 font-medium">ผู้ใช้</th>
              <th className="p-3 font-medium">การกระทำ</th>
              <th className="p-3 font-medium">กับข้อมูล</th>
              <th className="p-3 font-medium">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  ยังไม่มีบันทึกในหมวดนี้
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 align-top">
                  <td className="p-3 text-xs text-muted tabular-nums whitespace-nowrap">
                    {formatThaiDate(new Date(row.created_at))}{" "}
                    {formatTime(new Date(row.created_at))}
                  </td>
                  <td className="p-3 text-xs">
                    <span className="text-ink">{row.user_name ?? "ระบบ"}</span>
                    {row.user_email ? (
                      <span className="block text-muted break-all">{row.user_email}</span>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs">
                    <span
                      className={
                        SENSITIVE.has(row.action) ? "text-primary-dark font-semibold" : "text-ink-2"
                      }
                    >
                      {ACTION_LABEL[row.action] ?? row.action}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted">
                    {row.entity_type ?? "-"}
                    {row.entity_id ? (
                      <span className="block break-all opacity-70">{row.entity_id}</span>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs text-muted max-w-[280px]">
                    {row.after_json ? (
                      <code className="block break-all whitespace-pre-wrap opacity-80">
                        {JSON.stringify(row.after_json).slice(0, 220)}
                      </code>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        perPage={PER_PAGE}
        makeHref={(next) =>
          `/admin-cms/audit?${new URLSearchParams({
            ...(actionFilter ? { action: actionFilter } : {}),
            ...(next > 1 ? { page: String(next) } : {}),
          }).toString()}`
        }
      />
    </div>
  );
}
