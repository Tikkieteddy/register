/**
 * ข้อความ 2 ภาษา — ค่าเริ่มต้นเป็นภาษาไทย (ข้อกำหนด D6)
 *
 * ตามคำตอบ Q17 แปลเฉพาะหน้าสาธารณะ ส่วนหลังบ้าน Admin/Staff เป็นภาษาไทยอย่างเดียว
 */

export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** โครงสร้างข้อความทั้งหมด — ภาษาไทยเป็นต้นฉบับ ภาษาอื่นต้องมีคีย์ครบเหมือนกัน */
const th = {
  nav: {
    details: "รายละเอียดงาน",
    schedule: "กำหนดการ",
    speakers: "วิทยากร",
    venue: "สถานที่",
    contact: "ติดต่อ",
    login: "เข้าสู่ระบบ",
  },
  landing: {
    register: "ลงทะเบียนเข้าร่วมงาน",
    soldOut: "ที่นั่งเต็มแล้ว",
    notifyMe: "แจ้งฉันหากมีที่นั่งว่าง",
    closed: "ปิดรับลงทะเบียนแล้ว",
    notOpenYet: "ยังไม่เปิดรับลงทะเบียน",
    seatsLeft: "เหลือ {n} ที่นั่ง",
    seatsLeftBySession: "ภาคเช้า {morning} · ภาคบ่าย {afternoon}",
    almostFull: "เหลือ {n} ที่นั่ง",
    highlights: "ไฮไลต์ภายในงาน",
    speakers: "วิทยากรเด่น",
    benefits: "สิ่งที่ผู้เข้าร่วมจะได้รับ",
    venue: "สถานที่จัดงาน",
    openInMaps: "เปิดใน Google Maps",
    organizer: "ผู้จัดงาน",
    share: "แชร์งานนี้",
    shareCopied: "คัดลอกลิงก์แล้ว",
    privacyPolicy: "นโยบายความเป็นส่วนตัว",
    terms: "ข้อกำหนดการใช้งาน",
  },
  stepper: { event: "อีเว้นท์", register: "ลงทะเบียน", done: "เสร็จสิ้น" },
  form: {
    registrantInfo: "ข้อมูลผู้ลงทะเบียน",
    firstName: "ชื่อ",
    lastName: "นามสกุล",
    email: "อีเมล",
    phone: "โทรศัพท์มือถือ",
    emailHelper: "(โปรดตรวจสอบอีเมลสำหรับรับตั๋วให้ถูกต้อง)",
    nameHelper:
      "(กรุณากรอกชื่อ-นามสกุลที่ตรงกับบัตรประชาชนของคุณ เพื่อประโยชน์ในการตรวจสอบของผู้จัด)",
    ticketTitle: "1 - Free",
    copyFromOther: "ใช้ข้อมูลของตั๋วอื่น",
    copyFromBuyer: "ใช้ข้อมูลของผู้สั่งจอง",
    sessionQuestion: "สนใจร่วมงานภาคเช้า และ/หรือ ภาคบ่าย",
    sessionFull: "เต็มแล้ว",
    consentPhotoTitle: "การยินยอมให้บันทึกภาพ",
    consentPhotoBody:
      "ข้าพเจ้ารับทราบว่าภายในงานมีการถ่ายภาพนิ่งและบันทึกวิดีโอ และยินยอมให้ผู้จัดงานนำภาพหรือวิดีโอที่มีข้าพเจ้าปรากฏอยู่ไปใช้เพื่อการประชาสัมพันธ์",
    consentPdpaBody:
      "ข้าพเจ้ายินยอมให้ผู้จัดงานเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้า เพื่อวัตถุประสงค์ในการจัดงานและการติดต่อสื่อสารที่เกี่ยวข้อง",
    agree: "ยินยอม",
    disagree: "ไม่ยินยอม",
    readPolicy: "อ่านนโยบายความเป็นส่วนตัว",
    saveForNextTime: "ต้องการบันทึกข้อมูลตั๋วนี้สำหรับใช้ในครั้งต่อไป",
    selectPlaceholder: "-----",
    otherPlaceholder: "โปรดระบุ",
  },
  summary: {
    title: "การลงทะเบียน",
    ticket: "ตั๋ว",
    ticketLine: "1 x Free",
    free: "ฟรี",
    total: "รวมทั้งสิ้น",
    totalFree: "FREE",
    acceptTerms: "ฉันยอมรับ{terms}และ{privacy}ของผู้จัดงาน",
    submit: "ลงทะเบียน",
    submitting: "กำลังดำเนินการ...",
    timeLeft: "เหลือเวลาจองที่นั่ง",
    expiredTitle: "หมดเวลาจองที่นั่งแล้ว",
    expiredBody:
      "ระบบได้คืนที่นั่งกลับเข้าสู่ระบบ กรุณาเริ่มลงทะเบียนใหม่อีกครั้ง ข้อมูลที่กรอกไว้ยังคงอยู่",
    restart: "เริ่มใหม่",
  },
};

const en: Dictionary = {
  nav: {
    details: "Event details",
    schedule: "Schedule",
    speakers: "Speakers",
    venue: "Venue",
    contact: "Contact",
    login: "Sign in",
  },
  landing: {
    register: "Register for this event",
    soldOut: "Sold out",
    notifyMe: "Notify me if a seat opens",
    closed: "Registration closed",
    notOpenYet: "Registration not open yet",
    seatsLeft: "{n} seats left",
    seatsLeftBySession: "Morning {morning} · Afternoon {afternoon}",
    almostFull: "Only {n} seats left",
    highlights: "Event highlights",
    speakers: "Featured speakers",
    benefits: "What you will get",
    venue: "Venue",
    openInMaps: "Open in Google Maps",
    organizer: "Organizer",
    share: "Share this event",
    shareCopied: "Link copied",
    privacyPolicy: "Privacy policy",
    terms: "Terms of use",
  },
  stepper: { event: "Event", register: "Register", done: "Done" },
  form: {
    registrantInfo: "Registrant information",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Mobile phone",
    emailHelper: "(Please make sure your email is correct to receive the ticket)",
    nameHelper: "(Please enter the name that matches your ID card for verification)",
    ticketTitle: "1 - Free",
    copyFromOther: "Use another ticket's information",
    copyFromBuyer: "Use the registrant's information",
    sessionQuestion: "Which session would you like to attend?",
    sessionFull: "Full",
    consentPhotoTitle: "Photography consent",
    consentPhotoBody:
      "I acknowledge that photographs and video will be taken at this event, and I consent to the organizer using images in which I appear for publicity purposes.",
    consentPdpaBody:
      "I consent to the organizer collecting, using and disclosing my personal data for the purposes of running this event and related communications.",
    agree: "I agree",
    disagree: "I do not agree",
    readPolicy: "Read the privacy policy",
    saveForNextTime: "Save this ticket's information for next time",
    selectPlaceholder: "-----",
    otherPlaceholder: "Please specify",
  },
  summary: {
    title: "Registration",
    ticket: "Ticket",
    ticketLine: "1 x Free",
    free: "Free",
    total: "Total",
    totalFree: "FREE",
    acceptTerms: "I accept the organizer's {terms} and {privacy}",
    submit: "Register",
    submitting: "Processing...",
    timeLeft: "Time left to hold your seat",
    expiredTitle: "Your seat hold has expired",
    expiredBody:
      "The seat has been returned to the pool. Please start again — the details you entered are still here.",
    restart: "Start again",
  },
};

export type Dictionary = typeof th;

const dictionaries: Record<Locale, Dictionary> = { th, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** แทนที่ตัวแปรในข้อความ เช่น "เหลือ {n} ที่นั่ง" */
export function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}
