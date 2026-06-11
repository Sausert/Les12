"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { useGame } from "./GameProvider";

export interface CrimeView {
  id: number;
  key: string;
  minRankId: number;
  unlocked: boolean;
  cooldownSec: number;
  successChance: number;
  minPayout: number;
  maxPayout: number;
  xpReward: number;
  heatGain: number;
  cooldownUntil: string | null;
}

interface AttemptResult {
  success: boolean;
  payout: number;
  xpGained: number;
  rankUp: { id: number; key: string } | null;
}

function secondsLeft(until: string | null): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
}

export function CrimeCard({
  crime,
  rankName,
  onChanged,
  onRankUp,
}: {
  crime: CrimeView;
  rankName: string;
  onChanged: () => void;
  onRankUp: (rankKey: string) => void;
}) {
  const t = useTranslations("crimes");
  const { refresh } = useGame();
  // A shared 1s tick; the remaining cooldown is derived, never stored.
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  useEffect(() => {
    if (!crime.cooldownUntil) return;
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [crime.cooldownUntil]);

  const cooldown = secondsLeft(crime.cooldownUntil);

  async function attempt() {
    setBusy(true);
    const res = await fetch(`/api/crimes/${crime.id}/attempt`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      onChanged();
      return;
    }
    const data: AttemptResult = await res.json();
    setResult(data);
    if (data.success && navigator.vibrate) navigator.vibrate(data.rankUp ? [60, 40, 120] : 35);
    if (data.rankUp) onRankUp(data.rankUp.key);
    refresh();
    onChanged();
    setTimeout(() => setResult(null), 2200);
  }

  const onCooldown = cooldown > 0;
  const fusePct = onCooldown ? Math.min(100, (cooldown / crime.cooldownSec) * 100) : 0;

  return (
    <div className={`dossier relative overflow-hidden p-4 ${crime.unlocked ? "" : "opacity-55"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-ivory">{t(`items.${crime.key}.name`)}</h3>
          <p className="mt-0.5 text-sm italic text-ivory-dim">{t(`items.${crime.key}.desc`)}</p>
        </div>
        <span className="shrink-0 rounded border border-gold/40 px-1.5 py-0.5 text-xs text-gold tabular-nums">
          {crime.successChance}%
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ivory-dim">
        <span className="tabular-nums">
          {t("payout")}: {crime.minPayout}–{crime.maxPayout} OMD
        </span>
        <span className="tabular-nums">
          {t("xpReward")}: {crime.xpReward} · {t("heatGain")}: +{crime.heatGain}
        </span>
      </div>

      {crime.unlocked ? (
        <button
          onClick={attempt}
          disabled={busy || onCooldown}
          className="relative mt-3 w-full overflow-hidden rounded bg-gold py-2 font-display text-sm text-night transition-transform active:scale-95 disabled:bg-smoke-light disabled:text-ivory-dim"
        >
          {/* Burning fuse: the cooldown drains out of the button. */}
          {onCooldown && (
            <span
              className="absolute inset-y-0 left-0 bg-blood/40 transition-[width] duration-1000 ease-linear"
              style={{ width: `${fusePct}%` }}
            />
          )}
          <span className="relative tabular-nums">
            {onCooldown ? `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}` : t("attempt")}
          </span>
        </button>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ivory-dim">
          <Lock size={12} /> {t("lockedAt", { rank: rankName })}
        </p>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-night/85"
          >
            <motion.span
              initial={{ scale: 2.4, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: -8 }}
              transition={{ type: "spring", stiffness: 400, damping: 16 }}
              className={`stamp text-2xl ${result.success ? "text-gold" : "text-blood-bright"}`}
            >
              {result.success ? t("succeeded") : t("failed")}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-sm text-ivory"
            >
              {result.success && result.payout > 0 && (
                <>{t("dirtyEarned", { amount: result.payout })} · </>
              )}
              {t("xpEarned", { amount: result.xpGained })}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
