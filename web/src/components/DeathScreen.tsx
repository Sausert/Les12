"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Skull } from "lucide-react";
import { useGame } from "./GameProvider";

export function DeathScreen() {
  const t = useTranslations();
  const { me, refresh } = useGame();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function respawn(body: { mode: "fresh" } | { mode: "witness"; newUsername: string }) {
    setBusy(true);
    const res = await fetch("/api/respawn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const key = `death.errors.${data.error ?? "invalid_input"}`;
      setError(t.has(key) ? t(key) : t("common.error"));
      return;
    }
    setError(null);
    refresh();
  }

  const witnessAffordable = (me?.cash ?? 0) >= (me?.witnessProtection.cost ?? Infinity);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col justify-center bg-night/97 px-6"
    >
      <div className="text-center">
        <Skull size={48} className="mx-auto text-blood-bright" />
        <h2 className="stamp mx-auto mt-4 inline-block text-3xl text-blood-bright">
          {t("death.title")}
        </h2>
        <p className="mt-4 italic text-ivory-dim">{t("death.body")}</p>
      </div>

      {error && <p className="mt-4 text-center text-sm text-blood-bright">{error}</p>}

      <div className="dossier mt-8 p-4">
        <h3 className="font-display text-base text-gold">{t("death.witnessTitle")}</h3>
        <p className="mt-1 text-sm text-ivory-dim">
          {t("death.witnessDesc", {
            cost: me?.witnessProtection.cost ?? 500,
            pct: me?.witnessProtection.xpKeptPct ?? 75,
          })}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t("death.newName")}
            disabled={!witnessAffordable}
            className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold disabled:opacity-40"
          />
          <button
            onClick={() => respawn({ mode: "witness", newUsername: newName.trim() })}
            disabled={busy || !witnessAffordable || newName.trim().length < 3}
            className="shrink-0 rounded bg-gold px-4 py-2 font-display text-sm text-night transition-transform active:scale-95 disabled:opacity-50"
          >
            {t("death.witnessButton")}
          </button>
        </div>
        {!witnessAffordable && (
          <p className="mt-1.5 text-xs text-blood-bright">{t("death.witnessUnaffordable")}</p>
        )}
      </div>

      <button
        onClick={() => respawn({ mode: "fresh" })}
        disabled={busy}
        className="mt-4 w-full rounded border border-ivory/30 px-4 py-2.5 text-ivory transition-colors hover:bg-ivory/10 disabled:opacity-50"
      >
        {t("death.freshButton")}
      </button>
      <p className="mt-1.5 text-center text-xs text-ivory-dim">{t("death.freshDesc")}</p>
    </motion.div>
  );
}
