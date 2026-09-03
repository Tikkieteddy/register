"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  holdSeatAction,
  releaseSeatAction,
  verifyHoldsAction,
} from "@/app/actions/registration";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import type { QuestionView, SessionView } from "@/db/queries";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatTimeRange } from "@/lib/datetime";
import {
  emailSchema,
  nameSchema,
  phoneSchema,
  REQUIRED,
  validateAnswer,
  type QuestionRule,
} from "@/lib/validation";
import { ChoiceGroup, CheckboxRow, SelectField, type Choice } from "./ChoiceFields";
import { PhoneField, TextField } from "./TextField";
import { SummaryPanel } from "./SummaryPanel";

/** เก็บสิ่งที่ผู้ใช้กรอกไว้ เพื่อไม่ให้หายเมื่อ validate ไม่ผ่านหรือกดย้อนกลับ (ข้อกำหนด D6) */
const DRAFT_KEY = "registration-draft";

type Answers = Record<string, { optionIds: string[]; otherText: string }>;

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  answers: Answers;
  consentPhoto: boolean;
  consentPdpa: boolean | null;
  saveForNextTime: boolean;
};

/** sessionStorage ไม่ส่ง event เมื่อเขียนในแท็บเดียวกัน จึงไม่ต้อง subscribe อะไร */
function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * ⚠️ getSnapshot ต้องคืนค่าที่เทียบด้วย Object.is แล้วเท่าเดิมเสมอถ้าข้อมูลไม่เปลี่ยน
 *    จึงคืนเป็น "สตริงดิบ" ไม่ใช่ object ที่สร้างใหม่ทุกครั้ง
 *    (ถ้าคืน object ใหม่ทุกครั้ง React จะ re-render ไม่รู้จบ = React error #185)
 */
function readDraftRaw(): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

/** ฝั่งเซิร์ฟเวอร์ไม่มี sessionStorage — คืน null เสมอ */
function readDraftRawOnServer(): string | null {
  return null;
}

const emptyDraft: Draft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  phoneCountryCode: "+66",
  answers: {},
  consentPhoto: false,
  consentPdpa: null,
  saveForNextTime: false,
};

export function RegistrationForm({
  eventSlug,
  sessions,
  questions,
  dict,
  locale,
  privacyHref,
}: {
  eventSlug: string;
  sessions: SessionView[];
  questions: QuestionView[];
  dict: Dictionary;
  locale: "th" | "en";
  privacyHref: string;
}) {
  /**
   * กู้ข้อมูลที่กรอกค้างไว้ — ใช้ useSyncExternalStore แทนการ setState ใน effect
   *
   * ฝั่งเซิร์ฟเวอร์คืน null เสมอ ส่วนฝั่งเบราว์เซอร์คืนค่าที่เก็บไว้
   * React จัดการความต่างระหว่าง 2 ฝั่งนี้ให้เอง จึงไม่เกิด hydration mismatch
   * (sessionStorage ไม่ส่ง event เมื่อเขียนในแท็บเดียวกัน subscribe จึงไม่ต้องทำอะไร)
   */
  const storedRaw = useSyncExternalStore(subscribeToNothing, readDraftRaw, readDraftRawOnServer);
  const storedDraft = useMemo<Draft | null>(() => {
    if (!storedRaw) return null;
    try {
      return { ...emptyDraft, ...(JSON.parse(storedRaw) as Partial<Draft>) };
    } catch {
      return null;
    }
  }, [storedRaw]);
  const [edits, setEdits] = useState<Draft | null>(null);
  const draft: Draft = edits ?? storedDraft ?? emptyDraft;
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  /** โทเคนการจองที่นั่ง แยกตามช่วงเวลา */
  const [holds, setHolds] = useState<Record<string, { token: string; expiresAt: string }>>({});
  const [seatState, setSeatState] = useState<Record<string, { remaining: number; full: boolean }>>(
    Object.fromEntries(sessions.map((s) => [s.id, { remaining: s.remaining, full: s.isFull }])),
  );
  /** ช่วงเวลาที่กำลังรอเซิร์ฟเวอร์ตอบ — กันกดรัว */
  const [pendingSessions, setPendingSessions] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  /** honeypot — คนมองไม่เห็น ถ้ามีค่าแปลว่าเป็น bot */
  const [website, setWebsite] = useState("");

  const formRef = useRef<HTMLFormElement>(null);

  // เก็บข้อมูลที่กรอกลง sessionStorage ทุกครั้งที่เปลี่ยน
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // โหมดส่วนตัวของบางเบราว์เซอร์เขียนไม่ได้ — ข้ามไป ไม่ใช่เรื่องคอขาดบาดตาย
    }
  }, [draft]);

  // ---------- นาฬิกาหมดอายุ = โทเคนที่หมดอายุเร็วที่สุด ----------
  const earliestExpiry = useMemo(() => {
    const list = Object.values(holds).map((h) => new Date(h.expiresAt).getTime());
    return list.length > 0 ? new Date(Math.min(...list)) : null;
  }, [holds]);

  const setDraft = useCallback(
    (updater: (previous: Draft) => Draft) => {
      setEdits((current) => updater(current ?? storedDraft ?? emptyDraft));
    },
    [storedDraft],
  );

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
    },
    [setDraft],
  );

  const clearError = useCallback((key: string) => {
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  /**
   * เลือก / ยกเลิกช่วงเวลา แล้วจอง / คืนที่นั่งทันที
   *
   * อัปเดตหน้าจอก่อนแบบ optimistic เพื่อให้ช่องติ๊กตอบสนองทันทีที่กด
   * ไม่ต้องรอเซิร์ฟเวอร์ตอบกลับ (ผู้ใช้จะรู้สึกว่ากดแล้วไม่มีอะไรเกิดขึ้น)
   * ถ้าเซิร์ฟเวอร์ปฏิเสธ เช่น ที่นั่งเต็มพอดี จะย้อนสถานะกลับพร้อมแจ้งเหตุผล
   */
  async function toggleSession(sessionId: string) {
    // กันกดรัวระหว่างรอเซิร์ฟเวอร์ตอบ
    if (pendingSessions.includes(sessionId)) return;

    setBanner(null);
    clearError("sessionIds");
    setPendingSessions((p) => [...p, sessionId]);

    const held = holds[sessionId];
    const wasSelected = Boolean(held);

    // ① อัปเดตหน้าจอทันที
    setSelectedSessions((s) =>
      wasSelected ? s.filter((id) => id !== sessionId) : [...s, sessionId],
    );

    try {
      if (wasSelected && held) {
        await releaseSeatAction(held.token);
        setHolds((h) => {
          const next = { ...h };
          delete next[sessionId];
          return next;
        });
        setSeatState((s) => ({
          ...s,
          [sessionId]: { remaining: (s[sessionId]?.remaining ?? 0) + 1, full: false },
        }));
        return;
      }

      const result = await holdSeatAction(eventSlug, sessionId);

      if (!result.ok) {
        // ② เซิร์ฟเวอร์ปฏิเสธ — ย้อนสถานะกลับ
        setSelectedSessions((s) => s.filter((id) => id !== sessionId));
        setBanner(result.message);
        setSeatState((s) => ({
          ...s,
          [sessionId]: { remaining: result.remaining, full: result.remaining <= 0 },
        }));
        return;
      }

      setHolds((h) => ({
        ...h,
        [sessionId]: { token: result.holdToken, expiresAt: result.expiresAt },
      }));
      setSeatState((s) => ({
        ...s,
        [sessionId]: { remaining: result.remaining, full: result.remaining <= 0 },
      }));
      setExpired(false);
    } catch {
      // เครือข่ายมีปัญหา — ย้อนสถานะกลับให้ตรงกับความจริง
      setSelectedSessions((s) =>
        wasSelected ? [...s, sessionId] : s.filter((id) => id !== sessionId),
      );
      setBanner("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPendingSessions((p) => p.filter((id) => id !== sessionId));
    }
  }

  // ---------- คืนที่นั่งเมื่อผู้ใช้ปิดหน้า ----------
  useEffect(() => {
    function handleUnload() {
      const tokens = Object.values(holds).map((h) => h.token);
      if (tokens.length === 0) return;
      const body = JSON.stringify({ tokens });
      navigator.sendBeacon?.("/api/release-holds", new Blob([body], { type: "application/json" }));
    }
    window.addEventListener("pagehide", handleUnload);
    return () => window.removeEventListener("pagehide", handleUnload);
  }, [holds]);

  const handleExpire = useCallback(() => {
    setExpired(true);
    setHolds({});
    setSelectedSessions([]);
  }, []);

  // ---------- ตรวจข้อมูลทั้งฟอร์ม ----------
  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    const nameFirst = nameSchema.safeParse(draft.firstName);
    if (!nameFirst.success) next.firstName = nameFirst.error.issues[0]?.message ?? REQUIRED;

    const nameLast = nameSchema.safeParse(draft.lastName);
    if (!nameLast.success) next.lastName = nameLast.error.issues[0]?.message ?? REQUIRED;

    const email = emailSchema.safeParse(draft.email);
    if (!email.success) next.email = email.error.issues[0]?.message ?? REQUIRED;

    const phone = phoneSchema.safeParse(draft.phone);
    if (!phone.success) next.phone = phone.error.issues[0]?.message ?? REQUIRED;

    if (selectedSessions.length === 0) {
      next.sessionIds = "โปรดเลือกช่วงเวลาที่ต้องการเข้าร่วม";
    }

    for (const q of questions) {
      const rule: QuestionRule = {
        id: q.id,
        labelTh: q.labelTh,
        isRequired: q.isRequired,
        minSelect: q.minSelect,
        maxSelect: q.maxSelect,
        hasOtherOption: q.hasOtherOption,
        otherOptionIds: q.options.filter((o) => o.isOther).map((o) => o.id),
      };
      const a = draft.answers[q.id];
      const message = validateAnswer(rule, {
        questionId: q.id,
        optionIds: a?.optionIds ?? [],
        otherText: a?.otherText,
      });
      if (message) next[`q_${q.id}`] = message;
    }

    if (!draft.consentPhoto) {
      next.consentPhoto = "กรุณายืนยันการยินยอมให้บันทึกภาพ เพื่อดำเนินการต่อ";
    }
    if (draft.consentPdpa !== true) {
      next.consentPdpa = "กรุณาให้ความยินยอมการเก็บข้อมูลส่วนบุคคล เพื่อดำเนินการต่อ";
    }
    if (!acceptedTerms) {
      next.consentTerms = "กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว";
    }

    return next;
  }

  async function handleSubmit() {
    setBanner(null);
    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      // เลื่อนไปยังช่องแรกที่ผิดโดยอัตโนมัติ ตามข้อกำหนดในหัวข้อ 1.4
      const firstKey = Object.keys(found)[0];
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, select, textarea")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      // ตรวจว่าโทเคนยังไม่หมดอายุก่อนส่งจริง
      const tokens = Object.values(holds).map((h) => h.token);
      const verified = await verifyHoldsAction(tokens);
      if (!verified.ok) {
        handleExpire();
        setSubmitting(false);
        return;
      }

      // TODO(เฟส 3): บันทึกลงฐานข้อมูล สร้าง QR แล้วพาไปหน้า "เสร็จสิ้น"
      setBanner(
        "ตรวจสอบข้อมูลผ่านครบทุกข้อและที่นั่งถูกจองไว้แล้ว — การบันทึกและออกตั๋วจะทำในเฟส 3",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !expired && selectedSessions.length > 0 && acceptedTerms && !submitting;

  // ---------- ตัวเลือกช่วงเวลา ----------
  const sessionChoices: Choice[] = sessions.map((s) => {
    const state = seatState[s.id];
    const full = state?.full ?? s.isFull;
    const label = `${locale === "en" && s.nameEn ? s.nameEn : s.nameTh} (${formatTimeRange(
      s.startsAt,
      s.endsAt,
      locale,
    )})`;
    return {
      id: s.id,
      label,
      disabled: s.isClosed || (full && !selectedSessions.includes(s.id)),
      disabledNote: dict.form.sessionFull,
    };
  });

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      noValidate
      className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start pb-56 lg:pb-12"
    >
      <div className="flex flex-col gap-4 min-w-0">
        {banner && (
          <p role="status" className="bg-warning-bg border border-[color:var(--color-warning)] text-ink rounded-[var(--radius-control)] px-4 py-3 text-sm">
            {banner}
          </p>
        )}

        {expired && (
          <div role="alert" className="bg-[var(--color-danger-bg)] border border-[color:var(--color-danger-border)] rounded-[var(--radius-control)] px-4 py-3">
            <p className="font-semibold text-danger">{dict.summary.expiredTitle}</p>
            <p className="text-sm text-ink-2 mt-1">{dict.summary.expiredBody}</p>
          </div>
        )}

        {/* ---------- การ์ดข้อมูลผู้ลงทะเบียน ---------- */}
        <Card accent>
          <CardBody className="flex flex-col gap-4">
            <CardTitle>{dict.form.registrantInfo}</CardTitle>
            <div className="grid sm:grid-cols-2 gap-4">
              <div data-field="firstName">
                <TextField
                  id="firstName"
                  label={dict.form.firstName}
                  required
                  value={draft.firstName}
                  onChange={(v) => { set("firstName", v); clearError("firstName"); }}
                  error={errors.firstName}
                  autoComplete="given-name"
                  maxLength={100}
                />
              </div>
              <div data-field="lastName">
                <TextField
                  id="lastName"
                  label={dict.form.lastName}
                  required
                  value={draft.lastName}
                  onChange={(v) => { set("lastName", v); clearError("lastName"); }}
                  error={errors.lastName}
                  autoComplete="family-name"
                  maxLength={100}
                />
              </div>
            </div>
            <p className="text-sm text-muted italic -mt-2">{dict.form.nameHelper}</p>

            <div data-field="email">
              <TextField
                id="email"
                label={dict.form.email}
                required
                type="email"
                inputMode="email"
                value={draft.email}
                onChange={(v) => { set("email", v); clearError("email"); }}
                error={errors.email}
                helper={dict.form.emailHelper}
                autoComplete="email"
                maxLength={255}
              />
            </div>

            <div data-field="phone">
              <PhoneField
                id="phone"
                label={dict.form.phone}
                required
                value={draft.phone}
                onChange={(v) => { set("phone", v); clearError("phone"); }}
                countryCode={draft.phoneCountryCode}
                onCountryCodeChange={(v) => set("phoneCountryCode", v)}
                error={errors.phone}
              />
            </div>
          </CardBody>
        </Card>

        {/* ---------- การ์ดตั๋ว ---------- */}
        <Card accent>
          <CardBody className="flex flex-col gap-5">
            <h2 className="text-base font-semibold text-primary-dark">{dict.form.ticketTitle}</h2>

            {/* ช่วงเวลาที่สนใจ */}
            <div data-field="sessionIds">
              <ChoiceGroup
                id="sessionIds"
                label={dict.form.sessionQuestion}
                required
                multiple
                choices={sessionChoices}
                selected={selectedSessions}
                onToggle={(id) => void toggleSession(id)}
                error={errors.sessionIds}
              />
            </div>

            {/* คำถามที่ Admin ตั้งค่าไว้ */}
            {questions.map((q) => {
              const answer = draft.answers[q.id] ?? { optionIds: [], otherText: "" };
              const key = `q_${q.id}`;
              const label = locale === "en" && q.labelEn ? q.labelEn : q.labelTh;
              const helper =
                locale === "en" && q.helperTextEn ? q.helperTextEn : (q.helperTextTh ?? undefined);
              const choices: Choice[] = q.options.map((o) => ({
                id: o.id,
                label: locale === "en" && o.labelEn ? o.labelEn : o.labelTh,
                isOther: o.isOther,
              }));

              function updateAnswer(next: { optionIds: string[]; otherText: string }) {
                setDraft((d) => ({ ...d, answers: { ...d.answers, [q.id]: next } }));
                clearError(key);
              }

              return (
                <div key={q.id} data-field={key}>
                  {q.type === "dropdown" ? (
                    <SelectField
                      id={key}
                      label={label}
                      required={q.isRequired}
                      error={errors[key]}
                      choices={choices}
                      placeholder={dict.form.selectPlaceholder}
                      value={answer.optionIds[0] ?? ""}
                      onChange={(v) => updateAnswer({ optionIds: v ? [v] : [], otherText: answer.otherText })}
                    />
                  ) : (
                    <ChoiceGroup
                      id={key}
                      label={label}
                      helper={helper}
                      required={q.isRequired}
                      error={errors[key]}
                      multiple={q.type === "checkbox"}
                      maxSelect={q.maxSelect}
                      choices={choices}
                      selected={answer.optionIds}
                      otherText={answer.otherText}
                      otherPlaceholder={dict.form.otherPlaceholder}
                      onOtherTextChange={(v) => updateAnswer({ ...answer, otherText: v })}
                      onToggle={(id) => {
                        const has = answer.optionIds.includes(id);
                        const optionIds =
                          q.type === "checkbox"
                            ? has
                              ? answer.optionIds.filter((x) => x !== id)
                              : [...answer.optionIds, id]
                            : [id];
                        updateAnswer({ ...answer, optionIds });
                      }}
                    />
                  )}
                  {/* ตัวเลือก "อื่นๆ" ของ dropdown ต้องมีช่องพิมพ์เองด้วย */}
                  {q.type === "dropdown" &&
                    q.options.some((o) => o.isOther && answer.optionIds.includes(o.id)) && (
                      <input
                        type="text"
                        value={answer.otherText}
                        onChange={(e) => updateAnswer({ ...answer, otherText: e.target.value })}
                        placeholder={dict.form.otherPlaceholder}
                        aria-label={`${label} — ระบุเพิ่มเติม`}
                        maxLength={200}
                        className="w-full min-h-[var(--control-height)] px-3.5 mt-3 rounded-[var(--radius-control)] bg-surface text-ink border border-line-strong"
                      />
                    )}
                </div>
              );
            })}

            {/* ยินยอมให้บันทึกภาพ — checkbox บังคับติ๊ก (ข้อกำหนด A1.4) */}
            <div data-field="consentPhoto" className="flex flex-col gap-2 pt-1">
              <h3 className="text-sm font-medium text-ink-2">
                {dict.form.consentPhotoTitle}
                <span className="text-primary ms-1" aria-hidden="true">*</span>
              </h3>
              <p className="text-sm text-ink-2 leading-relaxed">{dict.form.consentPhotoBody}</p>
              <CheckboxRow
                id="consentPhoto"
                checked={draft.consentPhoto}
                onChange={(v) => { set("consentPhoto", v); clearError("consentPhoto"); }}
                error={errors.consentPhoto}
              >
                ข้าพเจ้ายินยอมให้บันทึกภาพและนำไปใช้เพื่อการประชาสัมพันธ์
              </CheckboxRow>
            </div>

            {/* ยินยอม PDPA — radio ยินยอม/ไม่ยินยอม (ข้อกำหนด D3) */}
            <div data-field="consentPdpa" className="flex flex-col gap-2 pt-1">
              <p className="text-sm text-ink-2 leading-relaxed">
                {dict.form.consentPdpaBody}{" "}
                <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="text-primary-dark font-semibold underline">
                  {dict.form.readPolicy}
                </a>
                <span className="text-primary ms-1" aria-hidden="true">*</span>
              </p>
              {errors.consentPdpa && (
                <p role="alert" className="text-danger text-sm">{errors.consentPdpa}</p>
              )}
              <div role="radiogroup" aria-label={dict.form.consentPdpaBody} className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {[
                  { value: true, label: dict.form.agree },
                  { value: false, label: dict.form.disagree },
                ].map((opt) => (
                  <label key={String(opt.value)} className="flex items-center gap-2.5 cursor-pointer text-ink">
                    <input
                      type="radio"
                      name="consentPdpa"
                      checked={draft.consentPdpa === opt.value}
                      onChange={() => { set("consentPdpa", opt.value); clearError("consentPdpa"); }}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* ตัวเลือกเสริม ไม่บังคับ */}
            <CheckboxRow
              id="saveForNextTime"
              checked={draft.saveForNextTime}
              onChange={(v) => set("saveForNextTime", v)}
            >
              {dict.form.saveForNextTime}
            </CheckboxRow>
          </CardBody>
        </Card>

        {/* honeypot กัน bot — ซ่อนจากสายตาและจาก screen reader */}
        <div aria-hidden="true" className="absolute w-px h-px overflow-hidden -left-[9999px]">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      <SummaryPanel
        dict={dict}
        expiresAt={earliestExpiry}
        onExpire={handleExpire}
        acceptedTerms={acceptedTerms}
        onAcceptTerms={(v) => { setAcceptedTerms(v); clearError("consentTerms"); }}
        termsError={errors.consentTerms}
        canSubmit={canSubmit}
        submitting={submitting}
        onSubmit={() => void handleSubmit()}
        privacyHref={privacyHref}
      />
    </form>
  );
}
