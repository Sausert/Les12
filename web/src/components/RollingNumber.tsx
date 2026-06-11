"use client";

import { useEffect, useRef, useState } from "react";

/** Animates towards `value` like a cash register counting up/down. */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = shown;
    const delta = value - from;
    if (delta === 0) return;
    const start = performance.now();
    const duration = Math.min(900, 250 + Math.abs(delta));

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + delta * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={`tabular-nums ${className ?? ""}`}>{shown.toLocaleString()}</span>;
}
