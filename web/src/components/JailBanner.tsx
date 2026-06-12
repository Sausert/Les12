"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { useGame } from "./GameProvider";

function remainingSeconds(until: string): number {
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
}

export function JailBanner() {
  const t = useTranslations();
  const { me, refresh } = useGame();
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.jailedUntil) return;
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [me?.jailedUntil]);

  if (!me?.jailedUntil) return null;
  const remaining = remainingSeconds(me.jailedUntil);
  if (remaining === 0) {
    // Sentence served — pull fresh state once.
    void refresh();
    return null;
  }

  async function bribe() {
    setBusy(true);
    const res = await fetch("/api/jail/bribe", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const key = `city.errors.${data.error ?? "invalid_input"}`;
      setError(t.has(key) ? t(key) : t("common.error"));
      return;
    }
    setError(null);
    refresh();
  }

  return (
    <div className="border-b border-police bg-police/30 px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-ivory">
        <Lock size={15} className="shrink-0 text-police" />
        <span className="flex-1">
          {t("city.jailedBanner", {
            time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`,
          })}
        </span>
        <button
          onClick={bribe}
          disabled={busy}
          className="shrink-0 rounded bg-gold px-3 py-1 font-display text-xs text-night transition-transform active:scale-95 disabled:opacity-50"
        >
          {t("city.bribeButton", { cost: me.bribeCost ?? 0 })}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-blood-bright">{error}</p>}
    </div>
  );
}
