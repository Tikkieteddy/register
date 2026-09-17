"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveUserAction } from "@/app/actions/admin/settings";
import { FIELD, Labeled, Notice, SaveButton, Toggle } from "./fields";

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "organizer" | "staff" | "viewer";
  canScan: boolean;
  isActive: boolean;
  lastLoginLabel: string;
  isLocked: boolean;
};

type Draft = {
  id?: string;
  email: string;
  fullName: string;
  role: "admin" | "organizer" | "staff" | "viewer";
  canScan: boolean;
  isActive: boolean;
  password: string;
};

const EMPTY: Draft = {
  email: "",
  fullName: "",
  role: "staff",
  canScan: true,
  isActive: true,
  password: "",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  organizer: "ผู้จัดงาน",
  staff: "เจ้าหน้าที่หน้างาน",
  viewer: "ดูอย่างเดียว (ไม่ได้ใช้งานแล้ว)",
};

export function UsersPanel({
  users,
  currentUserId,
  readOnly = false,
}: {
  users: UserRow[];
  currentUserId: string;
  /**
   * ผู้จัดงานเปิดหน้านี้ได้เพื่อดูว่าใครดูแลงานอยู่บ้าง แต่แก้ไม่ได้
   *
   * ⚠️ การซ่อนปุ่มตรงนี้เป็นแค่เรื่องหน้าตา ไม่ใช่การกันสิทธิ์จริง
   *    ตัวกันจริงอยู่ที่ saveUserAction ซึ่งตรวจซ้ำที่ฝั่งเซิร์ฟเวอร์เสมอ
   */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <Notice notice={notice} />

      {readOnly ? (
        <p className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
          สิทธิ์ผู้จัดงานดูรายชื่อได้อย่างเดียว —
          หากต้องการเพิ่มหรือแก้บัญชี กรุณาติดต่อผู้ดูแลระบบ
        </p>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...EMPTY });
              setErrors({});
            }}
            className="min-h-11 px-4 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark"
          >
            เพิ่มบัญชีผู้ใช้
          </button>
        </div>
      )}

      {draft ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await saveUserAction({
                ...draft,
                password: draft.password || undefined,
              });
              setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
              setNotice({ ok: result.ok, text: result.message });
              if (result.ok) {
                setDraft(null);
                router.refresh();
              }
            });
          }}
          className="border border-primary rounded-[var(--radius-card)] bg-primary-light/40 p-4 flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-ink">
            {draft.id ? "แก้ไขบัญชีผู้ใช้" : "เพิ่มบัญชีผู้ใช้"}
          </h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <Labeled label="อีเมล" error={errors.email}>
              <input
                className={FIELD}
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Labeled>
            <Labeled label="ชื่อ-นามสกุล" error={errors.fullName}>
              <input
                className={FIELD}
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              />
            </Labeled>
            <Labeled label="สิทธิ์การใช้งาน">
              <select
                className={FIELD}
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft["role"] })}
              >
                <option value="staff">
                  เจ้าหน้าที่หน้างาน — สแกนเช็คอินเท่านั้น เข้าหลังบ้านไม่ได้
                </option>
                <option value="organizer">
                  ผู้จัดงาน — เข้าหลังบ้านได้ทั้งหมด ยกเว้นเพิ่มหรือแก้บัญชีผู้ใช้
                </option>
                <option value="admin">ผู้ดูแลระบบ — ทำได้ทุกอย่าง รวมถึงจัดการบัญชีผู้ใช้</option>
              </select>
            </Labeled>
            <Labeled
              label={draft.id ? "ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน"}
              hint="อย่างน้อย 10 ตัวอักษร"
              error={errors.password}
            >
              <input
                type="password"
                className={FIELD}
                value={draft.password}
                autoComplete="new-password"
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </Labeled>
          </div>

          <Toggle
            checked={draft.canScan}
            onChange={(next) => setDraft({ ...draft, canScan: next })}
            label="ให้สแกน QR เช็คอินได้"
          />
          <Toggle
            checked={draft.isActive}
            onChange={(next) => setDraft({ ...draft, isActive: next })}
            label="เปิดใช้งานบัญชีนี้"
            /*
             * ⚠️ ข้อความเดิมคือ "ปิดเพื่อระงับบัญชีชั่วคราวโดยไม่ต้องลบ" ซึ่งอ่านได้สองทาง
             *    — "ปิดช่องนี้" (เอาติ๊กออก) หรือ "ปิดบัญชี" (ติ๊กแล้วบัญชีถูกปิด)
             *    ผู้ดูแลอาจเข้าใจกลับด้านแล้วเผลอระงับบัญชีเจ้าหน้าที่กลางงาน
             *    ซึ่งคนนั้นจะถูกเด้งออกทันทีและแก้เองไม่ได้ตรงนั้น
             */
            hint="เอาเครื่องหมายถูกออกเพื่อระงับบัญชีชั่วคราวโดยไม่ต้องลบ — คนนี้จะล็อกอินไม่ได้ทันที"
          />

          <div className="flex gap-2">
            <SaveButton pending={pending} />
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-line text-ink-2 text-sm hover:bg-surface-2"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto border border-line rounded-[var(--radius-card)] bg-surface">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">ชื่อ</th>
              <th className="p-3 font-medium">สิทธิ์</th>
              <th className="p-3 font-medium">สแกน QR</th>
              <th className="p-3 font-medium">สถานะ</th>
              <th className="p-3 font-medium">เข้าระบบล่าสุด</th>
              <th className="p-3 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line last:border-0">
                <td className="p-3">
                  <span className="text-ink font-medium">{user.fullName}</span>
                  <span className="block text-xs text-muted break-all">{user.email}</span>
                </td>
                <td className="p-3 text-ink-2 text-xs">{ROLE_LABEL[user.role] ?? user.role}</td>
                <td className="p-3 text-xs text-muted">{user.canScan ? "ได้" : "ไม่ได้"}</td>
                <td className="p-3 text-xs">
                  {!user.isActive ? (
                    <span className="text-danger">ระงับอยู่</span>
                  ) : user.isLocked ? (
                    <span className="text-[var(--color-warning)]">ถูกล็อกชั่วคราว</span>
                  ) : (
                    <span className="text-[var(--color-success)]">ใช้งานได้</span>
                  )}
                </td>
                <td className="p-3 text-xs text-muted tabular-nums whitespace-nowrap">
                  {user.lastLoginLabel}
                </td>
                <td className="p-3">
                  {readOnly ? (
                    <span className="text-xs text-muted">—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: user.id,
                          email: user.email,
                          fullName: user.fullName,
                          role: user.role,
                          canScan: user.canScan,
                          isActive: user.isActive,
                          password: "",
                        });
                        setErrors({});
                      }}
                      className="min-h-9 px-3 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2"
                    >
                      {user.id === currentUserId ? "แก้ไข (บัญชีของคุณ)" : "แก้ไข / ตั้งรหัสใหม่"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        แนะนำอย่างยิ่งให้เปิดการยืนยันตัวตนสองชั้น (2FA) กับบัญชีผู้ดูแลทุกบัญชี
        เพราะบัญชีนี้เข้าถึงข้อมูลส่วนบุคคลได้ทั้งหมด · ระบบไม่มีปุ่มลบบัญชีโดยตั้งใจ
        เพราะบันทึกใน audit log อ้างถึงบัญชีอยู่ — ให้ใช้การระงับแทน
      </p>
    </div>
  );
}
