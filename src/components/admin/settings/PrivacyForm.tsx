"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePrivacyAction } from "@/app/actions/admin/settings";
import { FIELD, Labeled, Notice, SaveButton } from "./fields";

/**
 * แท็บความเป็นส่วนตัว (หัวข้อ 3.7)
 *
 * เวอร์ชันนโยบายสำคัญทางกฎหมาย เพราะหลักฐานความยินยอมที่บันทึกไว้
 * จะอ้างถึงเวอร์ชันนี้ ถ้าแก้เนื้อหานโยบายแล้วไม่ขึ้นเวอร์ชัน
 * จะพิสูจน์ไม่ได้ว่าผู้ลงทะเบียนยินยอมตามข้อความชุดไหน
 */
export function PrivacyForm({
  eventId,
  policyVersion,
  dataRetentionDays,
  consentSummary,
}: {
  eventId: string;
  policyVersion: string;
  dataRetentionDays: number | null;
  consentSummary: { type: string; label: string; granted: number; total: number }[];
}) {
  const router = useRouter();
  const [version, setVersion] = useState(policyVersion);
  const [retention, setRetention] = useState(dataRetentionDays?.toString() ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await updatePrivacyAction({
              eventId,
              privacyPolicyVersion: version,
              dataRetentionDays: retention,
            });
            setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
            setNotice({ ok: result.ok, text: result.message });
            if (result.ok) router.refresh();
          });
        }}
        className="flex flex-col gap-3"
      >
        <Notice notice={notice} />

        <Labeled
          label="เวอร์ชันนโยบายความเป็นส่วนตัว"
          hint="ทุกครั้งที่แก้ข้อความนโยบาย ต้องขึ้นเวอร์ชันใหม่ เช่น 1.0 → 1.1 เพื่อให้พิสูจน์ได้ว่าใครยินยอมตามข้อความชุดไหน"
          error={errors.privacyPolicyVersion}
          className="max-w-xs"
        >
          <input className={FIELD} value={version} onChange={(e) => setVersion(e.target.value)} />
        </Labeled>

        <Labeled
          label="ระยะเวลาเก็บข้อมูลส่วนบุคคล (วัน)"
          hint="นับจากวันจบงาน · ครบกำหนดแล้วระบบจะลบชื่อ อีเมล และเบอร์โทรให้อัตโนมัติ แต่ยังเก็บยอดผู้เข้าร่วมไว้ ปล่อยว่าง = ไม่ลบอัตโนมัติ"
          error={errors.dataRetentionDays}
          className="max-w-xs"
        >
          <input
            className={FIELD}
            type="number"
            inputMode="numeric"
            placeholder="เช่น 180"
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
          />
        </Labeled>

        <p className="text-sm text-danger">
          ⚠️ การลบข้อมูลตามกำหนดนี้ย้อนกลับไม่ได้ — ส่งออกรายงานที่ต้องใช้ให้เรียบร้อยก่อนถึงกำหนด
        </p>

        <SaveButton pending={pending} label="บันทึกการตั้งค่า" />
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">สรุปหลักฐานความยินยอม</h2>
        {consentSummary.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีบันทึกความยินยอม</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {consentSummary.map((row) => (
              <li
                key={row.type}
                className="flex items-center justify-between gap-3 text-sm border border-line rounded-[var(--radius-control)] px-3 py-2"
              >
                <span className="text-ink-2">{row.label}</span>
                <span className="tabular-nums text-muted">
                  ยินยอม <strong className="text-ink">{row.granted}</strong> จาก {row.total} คน
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 text-sm text-ink-2">
        <h2 className="text-sm font-semibold text-ink">สิ่งที่ระบบทำให้อยู่แล้วตาม PDPA</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1 text-xs" style={{ listStyle: "disc" }}>
          <li>เก็บ IP เป็นค่าที่แฮชแล้วเท่านั้น ไม่มี IP ดิบอยู่ในฐานข้อมูลแม้แต่แถวเดียว</li>
          <li>QR ของตั๋วเป็นรหัสสุ่มล้วน ไม่มีชื่อ อีเมล หรือเบอร์โทรอยู่ข้างใน</li>
          <li>บันทึกความยินยอมพร้อมวันเวลาและเวอร์ชันนโยบายทุกครั้ง</li>
          <li>บันทึกทุกการเข้าถึง แก้ไข และส่งออกข้อมูลลง audit log</li>
          <li>ไม่ใช้ cookie ของบุคคลที่สาม และไม่ติดตามผู้ใช้ข้ามเว็บไซต์อื่น</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">คำขอลบข้อมูลส่วนบุคคล</h2>
        <p className="text-xs text-muted">
          เมื่อผู้ลงทะเบียนขอให้ลบข้อมูล ให้เปิดหน้ารายละเอียดของคนนั้นในเมนู “ผู้ลงทะเบียน”
          แล้วกดปุ่ม “ลบข้อมูลส่วนบุคคล (PDPA)” ระบบจะแทนที่ชื่อ อีเมล และเบอร์โทร
          ด้วยค่าที่ระบุตัวบุคคลไม่ได้ แต่ยังนับเป็น 1 คนในรายงานเหมือนเดิม
          เพื่อไม่ให้สถิติย้อนหลังเพี้ยน
        </p>
      </section>
    </div>
  );
}
