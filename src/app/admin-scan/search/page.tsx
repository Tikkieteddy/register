import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchScreen } from "@/components/staff/SearchScreen";
import { canScan, getSession } from "@/lib/auth/session";
import { getActiveEventSlug } from "@/lib/staff-event";

export const metadata: Metadata = { title: "ค้นหารายชื่อ — เจ้าหน้าที่" };

export default async function StaffSearchPage() {
  const session = await getSession();
  if (!canScan(session) || !session) redirect("/admin?next=/admin-scan/search");

  const slug = await getActiveEventSlug();
  if (!slug) redirect("/admin-scan");

  return <SearchScreen eventSlug={slug} staffName={session.fullName} />;
}
