"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { CrimeCard, type CrimeView } from "./CrimeCard";

export function CrimesList() {
  const t = useTranslations();
  const [crimes, setCrimes] = useState<CrimeView[] | null>(null);
  const [rankUp, setRankUp] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/crimes").then(async (res) => {
        if (res.ok) setCrimes(await res.json());
      }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Newspaper headline when a crime attempt promotes the player.
  const showRankUp = useCallback(
    (rankKey: string) => {
      setRankUp(t(`ranks.${rankKey}`));
      setTimeout(() => setRankUp(null), 3000);
    },
    [t],
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-xl text-ivory">{t("crimes.title")}</h2>
        <p className="text-sm italic text-ivory-dim">{t("crimes.subtitle")}</p>
      </div>

      {crimes === null && <p className="text-ivory-dim">{t("common.loading")}</p>}

      {crimes?.map((crime) => {
        const requiredRank = t(`ranks.${rankKeyForId(crime.minRankId)}`);
        return (
          <CrimeCard
            key={crime.id}
            crime={crime}
            rankName={requiredRank}
            onChanged={load}
            onRankUp={showRankUp}
          />
        );
      })}

      <AnimatePresence>
        {rankUp && (
          <motion.div
            initial={{ scale: 0.2, rotate: -540, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="fixed inset-x-6 top-1/3 z-50 mx-auto max-w-sm border-4 border-double border-ivory bg-ivory p-5 text-center text-night shadow-2xl"
          >
            <p className="font-display text-2xl">{t("crimes.rankUp")}</p>
            <p className="mt-1 font-body italic">{t("crimes.rankUpBody", { rank: rankUp })}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mirrors the seeded rank ids (prisma/seed.ts).
const rankKeys = [
  "empty_suit", "delivery_boy", "picciotto", "shoplifter", "pickpocket", "thief",
  "associate", "mobster", "soldier", "swindler", "assassin", "local_chief",
  "chief", "bruglione", "capodecina", "godfather",
];

function rankKeyForId(id: number): string {
  return rankKeys[id - 1] ?? rankKeys[0];
}
