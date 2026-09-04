"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/form/Field";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await loginAction({ email, password, remember });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && (
        <p
          role="alert"
          className="bg-[var(--color-danger-bg)] border border-[color:var(--color-danger-border)]
            text-danger rounded-[var(--radius-control)] px-4 py-3 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-ink-2 font-medium">
          อีเมล
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass(false)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-ink-2 font-medium">
          รหัสผ่าน
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass(false)} pe-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            className="absolute end-2 top-1/2 -translate-y-1/2 size-9 rounded-full text-muted hover:text-ink"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer text-sm text-ink-2">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="mt-1 size-4 accent-[var(--color-primary)]"
        />
        <span>
          จดจำอุปกรณ์นี้ไว้ 24 ชั่วโมง
          <span className="block text-muted text-xs mt-0.5">
            แนะนำให้ติ๊กในวันงาน จะได้ไม่ต้องล็อกอินซ้ำระหว่างสแกน
          </span>
        </span>
      </label>

      <Button type="submit" fullWidth loading={busy}>
        เข้าสู่ระบบ
      </Button>
    </form>
  );
}
