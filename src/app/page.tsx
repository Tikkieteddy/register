/**
 * หน้าชั่วคราวของเฟส 1 — แสดงสถานะการวางรากฐานโปรเจกต์
 * จะถูกแทนที่ด้วยหน้ารายละเอียดงานจริง (ข้อกำหนด D1) ในเฟส 2
 */
const phases = [
  { no: 1, name: "วางรากฐานโปรเจกต์", state: "current" },
  { no: 2, name: "หน้า Public + ฟอร์มลงทะเบียน", state: "todo" },
  { no: 3, name: "QR + อีเมล + หน้าเสร็จสิ้น", state: "todo" },
  { no: 4, name: "ระบบหน้างาน (Staff PWA)", state: "todo" },
  { no: 5, name: "ระบบหลังบ้าน (Admin)", state: "todo" },
  { no: 6, name: "ความปลอดภัยและ PDPA", state: "todo" },
  { no: 7, name: "ทดสอบ · Deploy · ส่งมอบ", state: "todo" },
] as const;

const foundations = [
  "Next.js 15 + TypeScript + Tailwind CSS v4",
  "Design Token สีธีม #EC5F27 (CSS Variables)",
  "ฟอนต์ไทย IBM Plex Sans Thai + Sarabun",
  "Schema ฐานข้อมูล 20 ตาราง (Drizzle ORM)",
  "ตรรกะตัดโควตาแบบ transaction + row lock",
  "ตรวจสอบ environment variables ด้วย Zod",
];

export default function Home() {
  return (
    <main
      style={{
        maxWidth: "56rem",
        margin: "0 auto",
        padding: "3rem 1.5rem 5rem",
        display: "flex",
        flexDirection: "column",
        gap: "2.5rem",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span
          style={{
            alignSelf: "flex-start",
            background: "var(--color-primary-light)",
            color: "var(--color-primary-dark)",
            padding: "0.3rem 0.75rem",
            borderRadius: "var(--radius-pill)",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          เฟส 1 · วางรากฐานโปรเจกต์
        </span>
        <h1 style={{ fontSize: "2rem", margin: 0, letterSpacing: "-0.02em" }}>
          ระบบรับลงทะเบียนเข้าร่วมงาน
        </h1>
        <p style={{ margin: 0, color: "var(--color-ink-2)", maxWidth: "44rem" }}>
          รากฐานโปรเจกต์พร้อมใช้งานแล้ว หน้ารายละเอียดงานและฟอร์มลงทะเบียนจริงจะมาในเฟส 2
        </p>
      </header>

      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderLeft: "3px solid var(--color-primary)",
          borderRadius: "0 var(--radius-lg) var(--radius-lg) 0",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.85rem" }}>สิ่งที่วางไว้แล้วในเฟสนี้</h2>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--color-ink-2)" }}>
          {foundations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.85rem" }}>แผนการทำงาน</h2>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
          {phases.map((phase) => {
            const isCurrent = phase.state === "current";
            return (
              <li
                key={phase.no}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.85rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: isCurrent ? "var(--color-primary-light)" : "var(--color-surface)",
                  border: `1px solid ${isCurrent ? "var(--color-primary)" : "var(--color-line)"}`,
                  color: isCurrent ? "var(--color-primary-dark)" : "var(--color-ink-2)",
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>
                  เฟส {phase.no}
                </span>
                <span>{phase.name}</span>
                {isCurrent && <span style={{ marginLeft: "auto", fontSize: "0.85rem" }}>กำลังทำ</span>}
              </li>
            );
          })}
        </ol>
      </section>

      <footer style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
        เอกสารกระบวนการทำงานฉบับเต็มอยู่ที่ <code>docs/00-กระบวนการทำงานทั้งหมด.md</code>
      </footer>
    </main>
  );
}
