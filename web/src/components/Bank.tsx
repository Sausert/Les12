"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { useGame } from "./GameProvider";
import { RollingNumber } from "./RollingNumber";

interface Tx {
  id: string;
  kind: "WITHDRAW" | "DEPOSIT" | "LAUNDER";
  amount: number;
  txHash: string | null;
  explorerUrl: string | null;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  createdAt: string;
}

function AmountForm({
  label,
  buttonLabel,
  onSubmit,
  disabled,
}: {
  label: string;
  buttonLabel: string;
  onSubmit: (amount: number) => Promise<void>;
  disabled?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const value = Number.parseInt(amount, 10);
        if (!Number.isInteger(value) || value <= 0) return;
        setBusy(true);
        await onSubmit(value);
        setBusy(false);
        setAmount("");
      }}
    >
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder={label}
        disabled={disabled}
        className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={busy || disabled || !amount}
        className="shrink-0 rounded bg-gold px-4 py-2 font-display text-sm text-night transition-transform active:scale-95 disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </form>
  );
}

export function Bank() {
  const t = useTranslations();
  const { me, refresh } = useGame();
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [chainDisabled, setChainDisabled] = useState(false);

  const loadTxs = useCallback(
    () =>
      fetch("/api/bank/txs").then(async (res) => {
        if (res.ok) setTxs(await res.json());
      }),
    [],
  );

  useEffect(() => {
    void loadTxs();
  }, [loadTxs]);

  function showError(code: string) {
    const key = `bank.errors.${code}`;
    setNotice({ kind: "error", text: t.has(key) ? t(key) : t("common.error") });
  }

  async function call(path: string, amount: number): Promise<Record<string, unknown> | null> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "chain_disabled") setChainDisabled(true);
      showError(data.error ?? "invalid_input");
      return null;
    }
    refresh();
    loadTxs();
    return data;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-ivory">{t("bank.title")}</h2>
        <p className="text-sm italic text-ivory-dim">{t("bank.subtitle")}</p>
      </div>

      <div className="dossier flex justify-around p-4 text-center">
        <div>
          <p className="text-xs text-ivory-dim">{t("common.cash")}</p>
          <p className="font-display text-lg text-gold">
            <RollingNumber value={me?.cash ?? 0} /> OMD
          </p>
        </div>
        <div>
          <p className="text-xs text-ivory-dim">{t("common.dirtyCash")}</p>
          <p className="font-display text-lg text-ivory-dim">
            <RollingNumber value={me?.dirtyCash ?? 0} /> OMD
          </p>
        </div>
        <div>
          <p className="text-xs text-ivory-dim">{t("common.heat")}</p>
          <p className={`font-display text-lg ${(me?.heat ?? 0) > 50 ? "text-blood-bright" : "text-ivory"}`}>
            <RollingNumber value={me?.heat ?? 0} />
          </p>
        </div>
      </div>

      {notice && (
        <p className={`text-sm ${notice.kind === "ok" ? "text-gold" : "text-blood-bright"}`}>
          {notice.text}
        </p>
      )}

      <section className="dossier p-4">
        <h3 className="font-display text-base">{t("bank.launderTitle")}</h3>
        <p className="mt-1 text-sm text-ivory-dim">{t("bank.launderDesc", { fee: 15 })}</p>
        <AmountForm
          label={t("bank.amount")}
          buttonLabel={t("bank.launderButton")}
          onSubmit={async (amount) => {
            const data = await call("/api/bank/launder", amount);
            if (data) {
              setNotice({
                kind: "ok",
                text: t("bank.launderSuccess", {
                  clean: Number(data.cleanGained),
                  fee: Number(data.fee),
                  heat: Math.max(0, (me?.heat ?? 0) - Number(data.heat)),
                }),
              });
            }
          }}
        />
      </section>

      <section className="dossier p-4">
        <h3 className="font-display text-base">{t("bank.withdrawTitle")}</h3>
        <p className="mt-1 text-sm text-ivory-dim">{t("bank.withdrawDesc")}</p>
        <AmountForm
          label={t("bank.amount")}
          buttonLabel={t("bank.withdrawButton")}
          disabled={chainDisabled}
          onSubmit={async (amount) => {
            const data = await call("/api/bank/withdraw", amount);
            if (data) setNotice({ kind: "ok", text: t("bank.txSuccess") });
          }}
        />
      </section>

      <section className="dossier p-4">
        <h3 className="font-display text-base">{t("bank.depositTitle")}</h3>
        <p className="mt-1 text-sm text-ivory-dim">{t("bank.depositDesc")}</p>
        <AmountForm
          label={t("bank.amount")}
          buttonLabel={t("bank.depositButton")}
          disabled={chainDisabled}
          onSubmit={async (amount) => {
            const data = await call("/api/bank/deposit", amount);
            if (data) setNotice({ kind: "ok", text: t("bank.txSuccess") });
          }}
        />
      </section>

      {chainDisabled && <p className="text-xs text-ivory-dim">{t("bank.chainDisabled")}</p>}

      <section>
        <h3 className="font-display text-base">{t("bank.txsTitle")}</h3>
        <div className="dossier mt-2 divide-y divide-gold/10">
          {txs !== null && txs.length === 0 && (
            <p className="p-4 text-sm text-ivory-dim">{t("bank.noTxs")}</p>
          )}
          {txs?.map((tx) => (
            <div key={tx.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="flex-1">
                {t(`bank.txKind.${tx.kind}`)} · {tx.amount.toLocaleString()} OMD
              </span>
              <span
                className={
                  tx.status === "CONFIRMED"
                    ? "text-gold"
                    : tx.status === "FAILED"
                      ? "text-blood-bright"
                      : "text-ivory-dim"
                }
              >
                {t(`bank.txStatus.${tx.status}`)}
              </span>
              {tx.explorerUrl && (
                <a href={tx.explorerUrl} target="_blank" rel="noreferrer" className="text-gold">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
