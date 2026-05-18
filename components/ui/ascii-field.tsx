"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const GLYPHS = " .·:+*oO0@".split("");

export function AsciiField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const cell = 14;
    let cols = 0;
    let rows = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / cell);
      rows = Math.ceil(h / cell);
      ctx.font = `${cell}px var(--font-mono), monospace`;
      ctx.textBaseline = "top";
    };

    const field = (x: number, y: number, t: number) => {
      const nx = x / cols - 0.5;
      const ny = y / rows - 0.5;
      const r = Math.sqrt(nx * nx + ny * ny);
      const a = Math.atan2(ny, nx);
      const v =
        Math.sin(r * 9 - t * 0.9) * 0.5 +
        Math.sin(nx * 6 + t * 0.5) * 0.25 +
        Math.sin(a * 3 + t * 0.3) * 0.25;
      return (v + 1) / 2;
    };

    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = field(x, y, t);
          const idx = Math.floor(v * (GLYPHS.length - 1));
          const alpha = 0.08 + v * 0.35;
          ctx.fillStyle = `oklch(0.75 0.12 250 / ${alpha.toFixed(3)})`;
          ctx.fillText(GLYPHS[idx], x * cell, y * cell);
        }
      }
      raf = requestAnimationFrame(render);
    };

    resize();
    raf = requestAnimationFrame(render);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,black,transparent_75%)]",
        className,
      )}
    />
  );
}
