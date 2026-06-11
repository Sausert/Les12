"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Shield, Target, Newspaper, Lock } from "lucide-react";
import { useGame } from "./GameProvider";
import { Market } from "./Market";

interface FoundTarget {
  username: string;
  rankId: number;
  isProtected: boolean;
  bulletsNeeded: number;
  foundUntil: string;
}

interface WantedRow {
  username: string;
  rankKey: string;
  total: number;
  contracts: number;
}

interface InmateRow {
  username: string;
  rankKey: string;
  jailedUntil: string;
}

interface FeedItem {
  id: string;
  type: "KILL" | "JAIL";
  attacker?: string;
  victim?: string;
  bloodMoney?: number;
  bountyPaid?: number;
  player?: string;
  at: string;
}

interface KillResult {
  success: boolean;
  bloodMoney: number;
  bountyPaid: number;
  xpGained: number;
}

async function postJson(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function City() {
  const t = useTranslations();
  const { me, refresh } = useGame();

  const [searchName, setSearchName] = useState("");
  const [target, setTarget] = useState<FoundTarget | null>(null);
  const [bullets, setBullets] = useState("");
  const [killResult, setKillResult] = useState<KillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [wanted, setWanted] = useState<WantedRow[] | null>(null);
  const [inmates, setInmates] = useState<InmateRow[] | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);

  const [bountyName, setBountyName] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");

  const loadLists = useCallback(
    () =>
      Promise.all([
        fetch("/api/bounty").then(async (res) => {
          if (res.ok) setWanted(await res.json());
        }),
        fetch("/api/jail").then(async (res) => {
          if (res.ok) setInmates(await res.json());
        }),
        fetch("/api/kill/feed").then(async (res) => {
          if (res.ok) setFeed(await res.json());
        }),
      ]),
    [],
  );

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  function showError(code: string) {
    const key = `city.errors.${code}`;
    setNotice(null);
    setError(t.has(key) ? t(key) : t("common.error"));
  }

  function showNotice(text: string) {
    setError(null);
    setNotice(text);
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setKillResult(null);
    const { ok, data } = await postJson("/api/kill/search", { username: searchName.trim() });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    setError(null);
    setTarget({ ...data.target, foundUntil: data.foundUntil });
  }

  async function fire(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    const amount = Number.parseInt(bullets, 10);
    if (!Number.isInteger(amount) || amount <= 0) return;
    setBusy(true);
    const { ok, data } = await postJson("/api/kill/attempt", {
      username: target.username,
      bullets: amount,
    });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    setError(null);
    setKillResult(data);
    setTarget(null);
    setBullets("");
    if (data.success && navigator.vibrate) navigator.vibrate([80, 50, 150]);
    refresh();
    loadLists();
    setTimeout(() => setKillResult(null), 4000);
  }

  async function buyBullets(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number.parseInt(buyAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) return;
    const { ok, data } = await postJson("/api/kill/bullets", { amount });
    if (!ok) return showError(data.error ?? "invalid_input");
    showNotice(t("city.bulletsBought", { amount, cost: Number(data.cost) }));
    setBuyAmount("");
    refresh();
  }

  async function buyProtection() {
    const { ok, data } = await postJson("/api/kill/protection");
    if (!ok) return showError(data.error ?? "invalid_input");
    showNotice(t("city.protectionBought"));
    refresh();
  }

  async function placeBounty(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number.parseInt(bountyAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) return;
    const { ok, data } = await postJson("/api/bounty/place", {
      username: bountyName.trim(),
      amount,
    });
    if (!ok) return showError(data.error ?? "invalid_input");
    showNotice(t("city.bountyPlaced", { target: data.target, amount }));
    setBountyName("");
    setBountyAmount("");
    refresh();
    loadLists();
  }

  async function breakout(username: string) {
    const { ok, data } = await postJson("/api/jail/breakout", { username });
    if (!ok) return showError(data.error ?? "invalid_input");
    showNotice(t(data.success ? "city.breakoutSuccess" : "city.breakoutFailed", { username }));
    refresh();
    loadLists();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-ivory">{t("city.title")}</h2>
        <p className="text-sm italic text-ivory-dim">{t("city.subtitle")}</p>
      </div>

      {error && <p className="text-sm text-blood-bright">{error}</p>}
      {notice && <p className="text-sm text-gold">{notice}</p>}

      {/* Search & shoot */}
      <section className="dossier p-4">
        <h3 className="flex items-center gap-2 font-display text-base">
          <Crosshair size={16} /> {t("city.huntTitle")}
        </h3>
        <form onSubmit={search} className="mt-2 flex gap-2">
          <input
            value={searchName}
            onChange={(event) => setSearchName(event.target.value)}
            placeholder={t("city.searchPlaceholder")}
            className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={busy || !searchName.trim()}
            className="shrink-0 rounded bg-gold px-4 py-2 font-display text-sm text-night transition-transform active:scale-95 disabled:opacity-50"
          >
            {t("city.searchButton")}
          </button>
        </form>

        {target && (
          <div className="mt-3 rounded border border-blood/40 bg-night/60 p-3">
            <p className="font-display text-ivory">
              {target.username}
              {target.isProtected && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-police">
                  <Shield size={12} /> {t("city.protected")}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-ivory-dim">
              {t("city.bulletsNeeded", { count: target.bulletsNeeded })} ·{" "}
              {t("city.yourBullets", { count: me?.bullets ?? 0 })}
            </p>
            <form onSubmit={fire} className="mt-2 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={bullets}
                onChange={(event) => setBullets(event.target.value)}
                placeholder={t("city.bulletsToFire")}
                className="w-full rounded border border-blood/40 bg-night px-3 py-2 text-ivory outline-none focus:border-blood-bright"
              />
              <button
                type="submit"
                disabled={busy || !bullets}
                className="shrink-0 rounded bg-blood px-4 py-2 font-display text-sm text-ivory transition-transform active:scale-95 disabled:opacity-50"
              >
                {t("city.fireButton")}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Armory */}
      <section className="dossier p-4">
        <h3 className="flex items-center gap-2 font-display text-base">
          <Target size={16} /> {t("city.armoryTitle")}
        </h3>
        <p className="mt-1 text-xs text-ivory-dim">
          {t("city.bulletPrice", { price: 30 })} · {t("city.yourBullets", { count: me?.bullets ?? 0 })}
        </p>
        <form onSubmit={buyBullets} className="mt-2 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={buyAmount}
            onChange={(event) => setBuyAmount(event.target.value)}
            placeholder={t("city.bulletsAmount")}
            className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={!buyAmount}
            className="shrink-0 rounded bg-gold px-4 py-2 font-display text-sm text-night transition-transform active:scale-95 disabled:opacity-50"
          >
            {t("city.buyButton")}
          </button>
        </form>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-ivory-dim">
            {me?.protectedUntil
              ? t("city.protectedUntil", {
                  time: new Date(me.protectedUntil).toLocaleString(),
                })
              : t("city.protectionDesc", { price: 200 })}
          </p>
          {!me?.protectedUntil && (
            <button
              onClick={buyProtection}
              className="shrink-0 rounded border border-police bg-police/30 px-3 py-1.5 text-xs text-ivory transition-transform active:scale-95"
            >
              <Shield size={12} className="mr-1 inline" />
              {t("city.protectionButton")}
            </button>
          )}
        </div>
      </section>

      {/* Most wanted */}
      <section>
        <h3 className="font-display text-base text-ivory">{t("city.wantedTitle")}</h3>
        <form onSubmit={placeBounty} className="mt-2 flex gap-2">
          <input
            value={bountyName}
            onChange={(event) => setBountyName(event.target.value)}
            placeholder={t("city.searchPlaceholder")}
            className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-sm text-ivory outline-none focus:border-gold"
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={bountyAmount}
            onChange={(event) => setBountyAmount(event.target.value)}
            placeholder="OMD"
            className="w-24 shrink-0 rounded border border-gold/30 bg-night px-3 py-2 text-sm text-ivory outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={!bountyName || !bountyAmount}
            className="shrink-0 rounded bg-gold px-3 py-2 font-display text-xs text-night transition-transform active:scale-95 disabled:opacity-50"
          >
            {t("city.bountyButton")}
          </button>
        </form>
        <div className="dossier mt-2 divide-y divide-gold/10">
          {wanted !== null && wanted.length === 0 && (
            <p className="p-3 text-sm text-ivory-dim">{t("city.noWanted")}</p>
          )}
          {wanted?.map((row) => (
            <div key={row.username} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="flex-1">
                {row.username}
                <span className="ml-2 text-xs text-ivory-dim">{t(`ranks.${row.rankKey}`)}</span>
              </span>
              <span className="font-display text-gold tabular-nums">
                {row.total.toLocaleString()} OMD
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Jail */}
      <section>
        <h3 className="flex items-center gap-2 font-display text-base text-ivory">
          <Lock size={16} /> {t("city.jailTitle")}
        </h3>
        <div className="dossier mt-2 divide-y divide-gold/10">
          {inmates !== null && inmates.length === 0 && (
            <p className="p-3 text-sm text-ivory-dim">{t("city.noInmates")}</p>
          )}
          {inmates?.map((inmate) => (
            <div key={inmate.username} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="flex-1">
                {inmate.username}
                <span className="ml-2 text-xs text-ivory-dim">
                  {t(`ranks.${inmate.rankKey}`)}
                </span>
              </span>
              {inmate.username !== me?.username && (
                <button
                  onClick={() => breakout(inmate.username)}
                  className="rounded border border-gold/40 px-2.5 py-1 text-xs text-gold transition-transform active:scale-95"
                >
                  {t("city.breakoutButton")}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <Market />

      {/* Kill feed as newspaper */}
      <section>
        <h3 className="flex items-center gap-2 font-display text-base text-ivory">
          <Newspaper size={16} /> {t("city.feedTitle")}
        </h3>
        <div className="mt-2 space-y-2">
          {feed !== null && feed.length === 0 && (
            <p className="text-sm text-ivory-dim">{t("city.noNews")}</p>
          )}
          {feed?.map((item) => (
            <article key={item.id} className="border border-ivory/20 bg-ivory/95 p-3 text-night">
              <p className="font-display text-sm uppercase tracking-wide">
                {item.type === "KILL"
                  ? t("city.feedKill", { attacker: item.attacker!, victim: item.victim! })
                  : t("city.feedJail", { player: item.player! })}
              </p>
              <p className="mt-0.5 text-xs italic text-night/70">
                {item.type === "KILL" && (item.bountyPaid ?? 0) > 0
                  ? t("city.feedBounty", { amount: item.bountyPaid! })
                  : new Date(item.at).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Kill result splash */}
      <AnimatePresence>
        {killResult && (
          <motion.div
            initial={{ scale: 0.2, rotate: -540, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="fixed inset-x-6 top-1/3 z-50 mx-auto max-w-sm border-4 border-double border-night bg-ivory p-5 text-center text-night shadow-2xl"
          >
            <p className="font-display text-2xl">
              {killResult.success ? t("city.killHeadline") : t("city.missHeadline")}
            </p>
            {killResult.success && (
              <p className="mt-1 font-body italic">
                {t("city.killBody", {
                  blood: killResult.bloodMoney,
                  bounty: killResult.bountyPaid,
                  xp: killResult.xpGained,
                })}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
