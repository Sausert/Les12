"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, Link2Off } from "lucide-react";
import { useGame } from "./GameProvider";

/**
 * Link an external wallet by signature: we show the challenge message, the
 * player signs it in their own wallet (personal_sign) and pastes the
 * signature. Withdrawals can then pay out to that address.
 */
export function WalletLink() {
  const t = useTranslations();
  const { me, refresh } = useGame();
  const [address, setAddress] = useState("");
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function showError(code: string) {
    const key = `walletLink.errors.${code}`;
    setError(t.has(key) ? t(key) : t("common.error"));
  }

  async function fetchChallenge() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/wallet/link?address=${encodeURIComponent(address.trim())}`);
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showError(data.error ?? "invalid_address");
    setMessage(data.message);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wallet/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: address.trim(), signature: signature.trim() }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showError(data.error ?? "invalid_signature");
    setMessage(null);
    setAddress("");
    setSignature("");
    refresh();
  }

  async function unlink() {
    await fetch("/api/wallet/link", { method: "DELETE" });
    refresh();
  }

  return (
    <div className="dossier p-4">
      <h3 className="flex items-center gap-2 font-display text-base">
        <Link2 size={16} /> {t("walletLink.title")}
      </h3>

      {me?.payoutAddress ? (
        <>
          <p className="mt-1 break-all font-mono text-xs text-gold">{me.payoutAddress}</p>
          <p className="mt-1 text-xs text-ivory-dim">{t("walletLink.linkedDesc")}</p>
          <button
            onClick={unlink}
            className="mt-2 flex items-center gap-1.5 rounded border border-blood px-2.5 py-1 text-xs text-blood-bright"
          >
            <Link2Off size={12} /> {t("walletLink.unlink")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-ivory-dim">{t("walletLink.desc")}</p>
          <div className="mt-2 flex gap-2">
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x…"
              className="w-full rounded border border-gold/30 bg-night px-3 py-2 font-mono text-xs text-ivory outline-none focus:border-gold"
            />
            <button
              onClick={fetchChallenge}
              disabled={busy || !address.trim()}
              className="shrink-0 rounded bg-gold px-3 py-2 font-display text-xs text-night disabled:opacity-50"
            >
              {t("walletLink.challengeButton")}
            </button>
          </div>
          {message && (
            <>
              <p className="mt-2 text-xs text-ivory-dim">{t("walletLink.signInstruction")}</p>
              <p className="mt-1 break-all rounded bg-night p-2 font-mono text-[0.65rem] text-gold">
                {message}
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={signature}
                  onChange={(event) => setSignature(event.target.value)}
                  placeholder={t("walletLink.signaturePlaceholder")}
                  className="w-full rounded border border-gold/30 bg-night px-3 py-2 font-mono text-xs text-ivory outline-none focus:border-gold"
                />
                <button
                  onClick={submit}
                  disabled={busy || !signature.trim()}
                  className="shrink-0 rounded bg-gold px-3 py-2 font-display text-xs text-night disabled:opacity-50"
                >
                  {t("walletLink.linkButton")}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {error && <p className="mt-2 text-xs text-blood-bright">{error}</p>}
    </div>
  );
}
