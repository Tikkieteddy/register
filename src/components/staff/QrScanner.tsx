"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * กล้องสแกน QR Code
 *
 * ใช้ @zxing/browser เพราะทำงานได้ทุกเบราว์เซอร์รวมถึง Safari บน iOS
 * (BarcodeDetector ที่มีในตัวเบราว์เซอร์ยังไม่รองรับ Safari)
 *
 * ⚠️ เบราว์เซอร์อนุญาตให้ใช้กล้องเฉพาะเมื่อหน้าเว็บเป็น HTTPS เท่านั้น
 *    (ยกเว้น localhost) — ต้องแจ้งเจ้าหน้าที่ให้ชัดถ้าเข้าผ่าน http
 */
export type ScannerStatus = "idle" | "starting" | "scanning" | "denied" | "unsupported" | "error";

export function QrScanner({
  onScan,
  paused,
}: {
  onScan: (text: string) => void;
  /** หยุดสแกนชั่วคราวตอนกำลังแสดงผลลัพธ์ ไม่งั้นจะยิงซ้ำรัว ๆ */
  paused: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const video = videoRef.current;
      if (!video) return;

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        setMessage(
          window.isSecureContext
            ? "เบราว์เซอร์นี้ไม่รองรับการใช้กล้อง กรุณาใช้ Chrome บน Android หรือ Safari บน iPhone"
            : "เบราว์เซอร์อนุญาตให้ใช้กล้องเฉพาะเว็บที่เป็น HTTPS เท่านั้น",
        );
        return;
      }

      setStatus("starting");
      try {
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 100,
        });

        const controls = await reader.decodeFromConstraints(
          // facingMode environment = กล้องหลัง ซึ่งใช้สแกนได้ดีกว่ากล้องหน้า
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result) => {
            if (!result || pausedRef.current) return;
            onScanRef.current(result.getText());
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setMessage(
            "ยังไม่ได้อนุญาตให้ใช้กล้อง — เปิดการตั้งค่าเบราว์เซอร์แล้วอนุญาตกล้อง จากนั้นรีเฟรชหน้านี้",
          );
        } else if (name === "NotFoundError") {
          setStatus("error");
          setMessage("ไม่พบกล้องบนอุปกรณ์นี้");
        } else {
          setStatus("error");
          setMessage("เปิดกล้องไม่สำเร็จ กรุณาปิดแอปอื่นที่ใช้กล้องอยู่ แล้วรีเฟรชหน้านี้");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  /** ไฟฉาย — ช่วยมากตอนสแกนในที่แสงน้อยหรือหน้าจอผู้ร่วมงานมืด */
  const toggleTorch = useCallback(async () => {
    const stream = videoRef.current?.srcObject;
    if (!(stream instanceof MediaStream)) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setMessage("อุปกรณ์นี้ไม่รองรับไฟฉาย");
    }
  }, [torchOn]);

  return (
    <div className="relative bg-black rounded-[var(--radius-card)] overflow-hidden aspect-[3/4] sm:aspect-video">
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full h-full object-cover"
        aria-label="ภาพจากกล้องสำหรับสแกน QR Code"
      />

      {/* กรอบเล็งกลางจอ */}
      {status === "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-56 sm:size-64 border-4 border-primary rounded-[var(--radius-card)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}

      {status === "scanning" && (
        <button
          type="button"
          onClick={() => void toggleTorch()}
          aria-pressed={torchOn}
          className="absolute top-3 end-3 size-11 rounded-full bg-black/55 text-white text-xl"
        >
          🔦<span className="sr-only">{torchOn ? "ปิดไฟฉาย" : "เปิดไฟฉาย"}</span>
        </button>
      )}

      {status !== "scanning" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/70">
          {status === "starting" && <p className="text-white">กำลังเปิดกล้อง...</p>}
          {message && <p className="text-white text-sm leading-relaxed">{message}</p>}
          {(status === "denied" || status === "error") && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 px-5 rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold"
            >
              รีเฟรชหน้านี้
            </button>
          )}
        </div>
      )}
    </div>
  );
}
