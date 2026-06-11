"use client";

import { useTranslations } from "next-intl";
import { Banknote, Coins, Flame, Target } from "lucide-react";
import { useGame } from "./GameProvider";
import { RollingNumber } from "./RollingNumber";

export function PlayerHeader() {
  const t = useTranslations();
  const { me } = useGame();

  return (
    <header className="sticky top-0 z-40 border-b border-gold/20 bg-night/95 px-4 pb-2 pt-3 backdrop-blur">
      {/* Heat makes the screen edges glow red. */}
      <div className="heat-glow" style={{ "--heat-level": me?.heat ?? 0 } as React.CSSProperties} />
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-lg text-gold">{t("common.appName")}</h1>
        {me && (
          <span className="text-sm text-ivory-dim">
            {me.username} · {t(`ranks.${me.rank.key}`)}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-gold" title={t("common.cash")}>
          <Banknote size={15} />
          <RollingNumber value={me?.cash ?? 0} />
        </span>
        <span className="flex items-center gap-1 text-ivory-dim" title={t("common.dirtyCash")}>
          <Coins size={15} />
          <RollingNumber value={me?.dirtyCash ?? 0} />
        </span>
        <span className="flex items-center gap-1 text-ivory-dim" title={t("common.bullets")}>
          <Target size={15} />
          <RollingNumber value={me?.bullets ?? 0} />
        </span>
        <span
          className={`ml-auto flex items-center gap-1 ${(me?.heat ?? 0) > 50 ? "text-blood-bright" : "text-ivory-dim"}`}
          title={t("common.heat")}
        >
          <Flame size={15} />
          <RollingNumber value={me?.heat ?? 0} />
        </span>
      </div>
    </header>
  );
}
