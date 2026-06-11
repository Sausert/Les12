"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Package } from "lucide-react";
import { useGame } from "./GameProvider";

interface GoodsRow {
  goodsKey: string;
  spotPrice: number;
  buyOne: number | null;
  sellOne: number;
  stock: number;
  owned: number;
}

interface MarketState {
  districtKey: string | null;
  carryCap: number;
  goods: GoodsRow[];
}

/** Smuggling market of the current district — trades settle in dirty cash. */
export function Market() {
  const t = useTranslations();
  const { me, refresh } = useGame();
  const [market, setMarket] = useState<MarketState | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/market").then(async (res) => {
        if (res.ok) setMarket(await res.json());
      }),
    [],
  );

  useEffect(() => {
    void load();
    // Reload when the player travels to another district.
  }, [load, me?.district?.id]);

  async function trade(goodsKey: string, action: "buy" | "sell") {
    const amount = Number.parseInt(qty[goodsKey] ?? "1", 10) || 1;
    const res = await fetch("/api/market/trade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goodsKey, action, qty: amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const key = `market.errors.${data.error ?? "invalid_input"}`;
      setNotice(null);
      setError(t.has(key) ? t(key) : t("common.error"));
      return;
    }
    setError(null);
    setNotice(
      action === "buy"
        ? t("market.bought", { qty: data.qty, cost: Number(data.cost) })
        : t("market.sold", { qty: data.qty, gain: Number(data.gain) }),
    );
    refresh();
    load();
  }

  if (!market) return null;

  return (
    <section>
      <h3 className="flex items-center gap-2 font-display text-base text-ivory">
        <Package size={16} /> {t("market.title")}
      </h3>
      <p className="mt-0.5 text-xs text-ivory-dim">
        {t("market.subtitle", { cap: market.carryCap })}
      </p>

      {error && <p className="mt-2 text-sm text-blood-bright">{error}</p>}
      {notice && <p className="mt-2 text-sm text-gold">{notice}</p>}

      <div className="dossier mt-2 divide-y divide-gold/10">
        {market.goods.map((row) => (
          <div key={row.goodsKey} className="px-4 py-2.5 text-sm">
            <div className="flex items-baseline justify-between">
              <span>
                {t(`market.goods.${row.goodsKey}`)}
                <span className="ml-2 text-xs text-ivory-dim">
                  {t("market.owned", { qty: row.owned })}
                </span>
              </span>
              <span className="font-display text-gold tabular-nums">
                ≈{row.spotPrice} OMD
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty[row.goodsKey] ?? ""}
                onChange={(event) =>
                  setQty((current) => ({ ...current, [row.goodsKey]: event.target.value }))
                }
                placeholder="1"
                className="w-16 rounded border border-gold/30 bg-night px-2 py-1 text-sm text-ivory outline-none focus:border-gold"
              />
              <button
                onClick={() => trade(row.goodsKey, "buy")}
                className="rounded bg-gold px-2.5 py-1 font-display text-xs text-night active:scale-95"
              >
                {t("market.buy", { price: row.buyOne ?? 0 })}
              </button>
              <button
                onClick={() => trade(row.goodsKey, "sell")}
                disabled={row.owned === 0}
                className="rounded border border-gold/40 px-2.5 py-1 text-xs text-gold active:scale-95 disabled:opacity-40"
              >
                {t("market.sell", { price: row.sellOne })}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[0.65rem] text-ivory-dim">{t("market.hint")}</p>
    </section>
  );
}
