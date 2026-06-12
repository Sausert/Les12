"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Gavel } from "lucide-react";
import { useGame } from "./GameProvider";

interface AuctionRow {
  id: string;
  itemKey: string;
  category: string;
  seller: string;
  startPrice: number;
  highBid: number;
  highBidder: string | null;
  endsAt: string;
  status: string;
  mine: boolean;
  settleable: boolean;
}

export function Auctions() {
  const t = useTranslations();
  const { refresh } = useGame();
  const [auctions, setAuctions] = useState<AuctionRow[] | null>(null);
  const [bids, setBids] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/auctions").then(async (res) => {
        if (res.ok) setAuctions(await res.json());
      }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const key = `auctions.errors.${data.error ?? "invalid_input"}`;
      setNotice(null);
      setError(t.has(key) ? t(key) : t("common.error"));
      return null;
    }
    setError(null);
    refresh();
    load();
    return data;
  }

  const open = auctions?.filter((a) => a.status === "OPEN") ?? [];

  return (
    <section>
      <h3 className="flex items-center gap-2 font-display text-base text-ivory">
        <Gavel size={16} /> {t("auctions.title")}
      </h3>
      <p className="mt-0.5 text-xs text-ivory-dim">{t("auctions.subtitle")}</p>

      {error && <p className="mt-2 text-sm text-blood-bright">{error}</p>}
      {notice && <p className="mt-2 text-sm text-gold">{notice}</p>}

      <div className="dossier mt-2 divide-y divide-gold/10">
        {auctions !== null && open.length === 0 && (
          <p className="p-3 text-sm text-ivory-dim">{t("auctions.none")}</p>
        )}
        {open.map((auction) => (
          <div key={auction.id} className="px-4 py-2.5 text-sm">
            <div className="flex items-baseline justify-between">
              <span>
                {t(`items.types.${auction.itemKey}`)}
                <span className="ml-2 text-xs text-ivory-dim">
                  {t("auctions.by", { seller: auction.seller })}
                </span>
              </span>
              <span className="font-display text-gold tabular-nums">
                {auction.highBidder
                  ? `${auction.highBid.toLocaleString()} OMD`
                  : t("auctions.startingAt", { price: auction.startPrice })}
              </span>
            </div>
            <p className="text-xs text-ivory-dim">
              {auction.highBidder
                ? t("auctions.highBidder", { name: auction.highBidder })
                : t("auctions.noBids")}{" "}
              · {t("auctions.endsAt", { time: new Date(auction.endsAt).toLocaleTimeString() })}
            </p>
            <div className="mt-1.5 flex gap-2">
              {!auction.mine && !auction.settleable && (
                <>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={bids[auction.id] ?? ""}
                    onChange={(event) =>
                      setBids((current) => ({ ...current, [auction.id]: event.target.value }))
                    }
                    placeholder="OMD"
                    className="w-24 rounded border border-gold/30 bg-night px-2 py-1 text-xs text-ivory outline-none"
                  />
                  <button
                    onClick={async () => {
                      const data = await post("/api/auctions/bid", {
                        auctionId: auction.id,
                        amount: Number.parseInt(bids[auction.id] ?? "0", 10),
                      });
                      if (data) setNotice(t("auctions.bidPlaced", { amount: Number(data.highBid) }));
                    }}
                    disabled={!bids[auction.id]}
                    className="rounded bg-gold px-2.5 py-1 font-display text-xs text-night disabled:opacity-50"
                  >
                    {t("auctions.bidButton")}
                  </button>
                </>
              )}
              {auction.settleable && (
                <button
                  onClick={async () => {
                    const data = await post("/api/auctions/settle", { auctionId: auction.id });
                    if (data) setNotice(t("auctions.settled"));
                  }}
                  className="rounded border border-gold/40 px-2.5 py-1 text-xs text-gold"
                >
                  {t("auctions.settleButton")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[0.65rem] text-ivory-dim">{t("auctions.hint")}</p>
    </section>
  );
}
