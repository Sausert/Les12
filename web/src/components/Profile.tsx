"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { LogOut, Trophy, Landmark } from "lucide-react";
import { useGame } from "./GameProvider";

export function Profile() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useGame();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = `/${locale}/login`;
  }

  if (!me) return <p className="text-ivory-dim">{t("common.loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="dossier p-5 text-center">
        <h2 className="font-display text-2xl text-ivory">{me.username}</h2>
        <p className="mt-1 font-display text-gold">{t(`ranks.${me.rank.key}`)}</p>
        <p className="mt-2 text-sm text-ivory-dim tabular-nums">
          {t("common.xp")}: {me.xp.toLocaleString()}
        </p>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-night">
            <div
              className="h-full bg-gradient-to-r from-gold-dim to-gold transition-[width] duration-700"
              style={{ width: `${me.rankProgress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ivory-dim">
            {me.nextRank
              ? `${t("profile.nextRank")}: ${t(`ranks.${me.nextRank.key}`)} (${me.nextRank.minXp.toLocaleString()} ${t("common.xp")})`
              : t("profile.maxRank")}
          </p>
        </div>
      </div>

      <div className="dossier p-4">
        <h3 className="font-display text-base">{t("common.heat")}</h3>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-night">
          <div
            className="h-full bg-gradient-to-r from-police via-blood to-blood-bright transition-[width] duration-700"
            style={{ width: `${me.heat}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ivory-dim">{t("profile.heatDesc")}</p>
      </div>

      <div className="dossier p-4">
        <h3 className="font-display text-base">{t("profile.walletTitle")}</h3>
        <p className="mt-1 break-all font-mono text-xs text-ivory-dim">
          {me.walletAddress ?? "—"}
        </p>
      </div>

      <div className="dossier p-4">
        <h3 className="font-display text-base">{t("profile.language")}</h3>
        <div className="mt-2 flex gap-2">
          {(["nl", "en"] as const).map((option) => (
            <button
              key={option}
              onClick={() => router.replace(pathname, { locale: option })}
              className={`rounded px-3 py-1 text-sm uppercase ${
                locale === option ? "bg-gold font-display text-night" : "bg-smoke text-ivory-dim"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <Link
        href="/bank"
        className="dossier flex items-center justify-center gap-2 p-3 text-sm text-gold"
      >
        <Landmark size={16} /> {t("nav.bank")}
      </Link>

      <Link
        href="/leaderboard"
        className="dossier flex items-center justify-center gap-2 p-3 text-sm text-gold"
      >
        <Trophy size={16} /> {t("nav.leaderboard")}
      </Link>

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded border border-blood px-4 py-2.5 text-blood-bright transition-colors hover:bg-blood/15"
      >
        <LogOut size={16} /> {t("common.logout")}
      </button>
    </div>
  );
}
