import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WalkInScreen } from "@/components/staff/WalkInScreen";
import { getEventBySlug, getFormQuestions } from "@/db/queries";
import { canScan, getSession } from "@/lib/auth/session";
import { getActiveEventSlug } from "@/lib/staff-event";

export const metadata: Metadata = { title: "ลงทะเบียนหน้างาน — เจ้าหน้าที่" };

export default async function StaffWalkInPage() {
  const session = await getSession();
  if (!canScan(session) || !session) redirect("/staff/login?next=/staff/walkin");

  const slug = await getActiveEventSlug();
  if (!slug) redirect("/staff");

  const data = await getEventBySlug(slug);
  if (!data) redirect("/staff");

  // ใช้ตัวเลือกอาชีพชุดเดียวกับฟอร์มออนไลน์ จะได้ทำรายงานรวมกันได้
  const questions = await getFormQuestions(data.event.id);
  const occupationQuestion = questions.find((q) => q.key === "occupation");
  const occupations = (occupationQuestion?.options ?? [])
    .filter((o) => !o.isOther)
    .map((o) => o.labelTh);

  return (
    <WalkInScreen
      eventSlug={slug}
      sessions={data.sessions}
      occupations={occupations}
      online
    />
  );
}
