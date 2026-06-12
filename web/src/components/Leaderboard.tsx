"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useGame } from "./GameProvider";

interface FameRow {
  seasonId: number;
  position: number;
  username: string;
  xp: number;
  trophyTokenId: number | null;
}

interface Row {
  position: number;
  username: string;
  xp: number;
  cash: number;
  rankKey: string;
}

export function Leaderboard() {
  const t = useTranslations();
  const { me } = useGame();
  const [by, setBy] = useState<"xp" | "cash">("xp");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fame, setFame] = useState<FameRow[]>([]);
  const [seasonId, setSeasonId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/season").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setFame(data.hallOfFame);
        setSeasonId(data.season?.id ?? null);
      }
    });
  }, []);

  useEffect(() => {
    fetch(`/api/leaderboard?by=${by}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setRows);
  }, [by]);

  return (
    <div>
      <h2 className="font-display text-xl text-ivory">{t("leaderboard.title")}</h2>
      <p className="text-sm italic text-ivory-dim">{t("leaderboard.subtitle")}</p>

      <div className="mt-3 flex gap-2">
        {(["xp", "cash"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setBy(option)}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              by === option ? "bg-gold font-display text-night" : "bg-smoke text-ivory-dim"
            }`}
          >
            {t(option === "xp" ? "leaderboard.byXp" : "leaderboard.byCash")}
          </button>
        ))}
      </div>

      <div className="dossier mt-3 divide-y divide-gold/10">
        {rows === null && <p className="p-4 text-ivory-dim">{t("common.loading")}</p>}
        {rows?.map((row) => (
          <div
            key={row.username}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              row.username === me?.username ? "bg-gold/10" : ""
            }`}
          >
            <span className="w-7 text-right font-display text-gold tabular-nums">
              {row.position}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ivory">{row.username}</p>
              <p className="text-xs text-ivory-dim">{t(`ranks.${row.rankKey}`)}</p>
            </div>
            <span className="text-sm text-ivory-dim tabular-nums">
              {(by === "xp" ? row.xp : row.cash).toLocaleString()}
              {by === "cash" && " OMD"}
            </span>
          </div>
        ))}
      </div>

      {seasonId !== null && (
        <p className="mt-3 text-xs text-ivory-dim">{t("leaderboard.season", { id: seasonId })}</p>
      )}
      {fame.length > 0 && (
        <>
          <h3 className="mt-4 font-display text-base text-ivory">{t("leaderboard.fameTitle")}</h3>
          <div className="dossier mt-2 divide-y divide-gold/10">
            {fame.map((row) => (
              <div
                key={`${row.seasonId}_${row.position}`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="font-display text-gold">
                  {["🥇", "🥈", "🥉"][row.position - 1] ?? row.position}
                </span>
                <span className="flex-1">
                  {row.username}
                  <span className="ml-2 text-xs text-ivory-dim">
                    {t("leaderboard.fameSeason", { id: row.seasonId })}
                  </span>
                </span>
                <span className="text-xs text-ivory-dim tabular-nums">
                  {row.xp.toLocaleString()} {t("common.xp")}
                  {row.trophyTokenId !== null && ` · NFT #${row.trophyTokenId}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
