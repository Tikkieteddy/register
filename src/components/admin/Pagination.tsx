import Link from "next/link";

/**
 * แถบแบ่งหน้า
 *
 * แสดงหน้ารอบ ๆ หน้าปัจจุบันเท่านั้น ไม่ไล่ทุกหน้า
 * เพราะงานใหญ่มีได้หลายพันรายการ ถ้าไล่ครบจะยาวจนใช้งานไม่ได้
 */
export function Pagination({
  page,
  pageCount,
  total,
  perPage,
  makeHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  makeHref: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return (
      <p className="text-sm text-muted">
        แสดงทั้งหมด {total.toLocaleString("th-TH")} รายการ
      </p>
    );
  }

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const windowSize = 2;
  const pages: number[] = [];
  for (let p = Math.max(1, page - windowSize); p <= Math.min(pageCount, page + windowSize); p++) {
    pages.push(p);
  }

  const linkClass =
    "min-w-11 min-h-11 inline-flex items-center justify-center px-3 rounded-[var(--radius-control)] text-sm border";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="แบ่งหน้า">
      <p className="text-sm text-muted tabular-nums">
        แสดง {from.toLocaleString("th-TH")}–{to.toLocaleString("th-TH")} จาก{" "}
        {total.toLocaleString("th-TH")} รายการ
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {page > 1 ? (
          <Link href={makeHref(page - 1)} className={`${linkClass} border-line text-ink-2 hover:bg-surface-2`}>
            ก่อนหน้า
          </Link>
        ) : null}
        {pages[0] !== 1 ? <span className="text-muted px-1">…</span> : null}
        {pages.map((p) => (
          <Link
            key={p}
            href={makeHref(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${linkClass} tabular-nums ${
              p === page
                ? "border-primary bg-primary text-primary-contrast font-semibold"
                : "border-line text-ink-2 hover:bg-surface-2"
            }`}
          >
            {p}
          </Link>
        ))}
        {pages[pages.length - 1] !== pageCount ? <span className="text-muted px-1">…</span> : null}
        {page < pageCount ? (
          <Link href={makeHref(page + 1)} className={`${linkClass} border-line text-ink-2 hover:bg-surface-2`}>
            ถัดไป
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
