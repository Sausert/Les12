"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Gem, HandCoins } from "lucide-react";
import { useGame } from "./GameProvider";

interface CatalogRow {
  key: string;
  category: string;
  price: number;
  effectPct: number;
  yieldPerDay: number;
}

interface ItemRow {
  id: string;
  key: string;
  category: string;
  effectPct: number;
  yieldPerDay: number;
  tokenId: number | null;
  escrowed: boolean;
  claimableYield: number;
}

export function Items() {
  const t = useTranslations();
  const { refresh } = useGame();
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [auctionItem, setAuctionItem] = useState<string | null>(null);
  const [startPrice, setStartPrice] = useState("");
  const [durationMin, setDurationMin] = useState("10");

  const load = useCallback(
    () =>
      fetch("/api/items").then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setCatalog(data.catalog);
          setItems(data.items);
        }
      }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function showError(code: string) {
    const key = `items.errors.${code}`;
    setNotice(null);
    setError(t.has(key) ? t(key) : t("common.error"));
  }

  async function post(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error ?? "invalid_input");
      return null;
    }
    setError(null);
    refresh();
    load();
    return data;
  }

  const claimable = items.reduce((sum, item) => sum + item.claimableYield, 0);

  function describe(row: { category: string; effectPct: number; yieldPerDay: number }): string {
    if (row.category === "WEAPON") return t("items.effectWeapon", { pct: row.effectPct });
    if (row.category === "CAR") return t("items.effectCar", { pct: row.effectPct });
    return t("items.effectProperty", { amount: row.yieldPerDay });
  }

  return (
    <section className="dossier p-4">
      <h3 className="flex items-center gap-2 font-display text-base">
        <Gem size={16} /> {t("items.title")}
      </h3>

      {error && <p className="mt-2 text-sm text-blood-bright">{error}</p>}
      {notice && <p className="mt-2 text-sm text-gold">{notice}</p>}

      {items.length > 0 && (
        <div className="mt-2 divide-y divide-gold/10">
          {items.map((item) => (
            <div key={item.id} className="py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`flex-1 ${item.escrowed ? "opacity-50" : ""}`}>
                  {t(`items.types.${item.key}`)}
                  {item.tokenId !== null && (
                    <span className="ml-2 text-xs text-ivory-dim">NFT #{item.tokenId}</span>
                  )}
                  {item.escrowed && (
                    <span className="ml-2 text-xs text-police">{t("items.inAuction")}</span>
                  )}
                </span>
                {!item.escrowed && item.tokenId !== null && (
                  <button
                    onClick={() => {
                      setAuctionItem(auctionItem === item.id ? null : item.id);
                    }}
                    className="rounded border border-gold/40 px-2 py-0.5 text-xs text-gold"
                  >
                    {t("items.auctionButton")}
                  </button>
                )}
              </div>
              <p className="text-xs text-ivory-dim">{describe(item)}</p>
              {auctionItem === item.id && (
                <form
                  className="mt-1.5 flex gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const data = await post("/api/auctions/create", {
                      itemId: item.id,
                      startPrice: Number.parseInt(startPrice, 10),
                      durationMin: Number.parseInt(durationMin, 10),
                    });
                    if (data) {
                      setNotice(t("items.auctionCreated"));
                      setAuctionItem(null);
                      setStartPrice("");
                    }
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    value={startPrice}
                    onChange={(event) => setStartPrice(event.target.value)}
                    placeholder={t("items.startPrice")}
                    className="w-24 rounded border border-gold/30 bg-night px-2 py-1 text-xs text-ivory outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={durationMin}
                    onChange={(event) => setDurationMin(event.target.value)}
                    placeholder={t("items.durationMin")}
                    className="w-20 rounded border border-gold/30 bg-night px-2 py-1 text-xs text-ivory outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!startPrice}
                    className="rounded bg-gold px-2.5 py-1 font-display text-xs text-night disabled:opacity-50"
                  >
                    {t("items.listButton")}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {claimable > 0 && (
        <button
          onClick={async () => {
            const data = await post("/api/items/claim-yield");
            if (data) setNotice(t("items.yieldClaimed", { amount: Number(data.claimed) }));
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-gold px-3 py-2 font-display text-sm text-night active:scale-95"
        >
          <HandCoins size={15} /> {t("items.claimYield", { amount: claimable })}
        </button>
      )}

      <h4 className="mt-4 font-display text-sm text-ivory-dim">{t("items.shopTitle")}</h4>
      <div className="mt-1 divide-y divide-gold/10">
        {catalog.map((row) => (
          <div key={row.key} className="flex items-center gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p>{t(`items.types.${row.key}`)}</p>
              <p className="text-xs text-ivory-dim">{describe(row)}</p>
            </div>
            <button
              onClick={async () => {
                const data = await post("/api/items/buy", { typeKey: row.key });
                if (data) setNotice(t("items.bought", { item: t(`items.types.${row.key}`) }));
              }}
              className="shrink-0 rounded bg-gold px-2.5 py-1 font-display text-xs text-night active:scale-95"
            >
              {row.price.toLocaleString()} OMD
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
