"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dices, CircleDot, Spade, Club, ShieldCheck } from "lucide-react";
import { useGame } from "./GameProvider";
import { PlayingCard } from "./PlayingCard";

type GameKey = "dice" | "roulette" | "blackjack" | "videopoker";

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function commit(): Promise<{ roundId: string; serverSeedHash: string } | null> {
  const res = await fetch("/api/casino/commit", { method: "POST" });
  return res.ok ? res.json() : null;
}

function useCasino() {
  const t = useTranslations();
  const { refresh } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  function showError(code: string) {
    const key = `casino.errors.${code}`;
    setError(t.has(key) ? t(key) : t("common.error"));
  }

  return { t, refresh, error, setError, showError, hash, setHash };
}

function BetInput({
  bet,
  setBet,
  disabled,
}: {
  bet: string;
  setBet: (v: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("casino");
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={10000}
      value={bet}
      onChange={(event) => setBet(event.target.value)}
      placeholder={t("bet")}
      disabled={disabled}
      className="w-24 rounded border border-gold/30 bg-night px-3 py-2 text-sm text-ivory outline-none focus:border-gold disabled:opacity-50"
    />
  );
}

function FairnessTag({ hash }: { hash: string | null }) {
  const t = useTranslations("casino");
  if (!hash) return null;
  return (
    <p className="mt-2 flex items-start gap-1 break-all text-[0.65rem] text-ivory-dim">
      <ShieldCheck size={12} className="mt-0.5 shrink-0 text-gold" />
      {t("committedHash")}: {hash}
    </p>
  );
}

// --- Dice ---

function DiceGame() {
  const { t, refresh, error, showError, setError, hash, setHash } = useCasino();
  const [bet, setBet] = useState("10");
  const [target, setTarget] = useState(50);
  const [result, setResult] = useState<{ roll: number; win: boolean; payout: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function play() {
    setBusy(true);
    setError(null);
    const round = await commit();
    if (!round) return setBusy(false);
    setHash(round.serverSeedHash);
    const { ok, data } = await postJson("/api/casino/dice", {
      roundId: round.roundId,
      bet: Number.parseInt(bet, 10),
      target,
    });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    setResult(data);
    refresh();
  }

  const multiplier = (99 / target).toFixed(2);

  return (
    <div>
      <label className="block text-sm text-ivory-dim">
        {t("casino.diceTarget", { target, chance: target, multiplier })}
        <input
          type="range"
          min={2}
          max={98}
          value={target}
          onChange={(event) => setTarget(Number(event.target.value))}
          className="mt-1 w-full accent-[#c9a227]"
        />
      </label>
      <div className="mt-2 flex items-center gap-2">
        <BetInput bet={bet} setBet={setBet} />
        <button
          onClick={play}
          disabled={busy || !bet}
          className="rounded bg-gold px-4 py-2 font-display text-sm text-night active:scale-95 disabled:opacity-50"
        >
          {t("casino.rollButton")}
        </button>
        {result && (
          <span
            className={`font-display text-lg tabular-nums ${result.win ? "text-gold" : "text-blood-bright"}`}
          >
            {result.roll} — {result.win ? `+${result.payout}` : t("casino.lost")}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-blood-bright">{error}</p>}
      <FairnessTag hash={hash} />
    </div>
  );
}

// --- Roulette ---

const ROULETTE_BETS = ["red", "black", "odd", "even", "low", "high"] as const;

function RouletteGame() {
  const { t, refresh, error, showError, setError, hash, setHash } = useCasino();
  const [bet, setBet] = useState("10");
  const [betType, setBetType] = useState<string>("red");
  const [number, setNumber] = useState("17");
  const [result, setResult] = useState<{ spin: number; win: boolean; payout: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function play() {
    setBusy(true);
    setError(null);
    const round = await commit();
    if (!round) return setBusy(false);
    setHash(round.serverSeedHash);
    const { ok, data } = await postJson("/api/casino/roulette", {
      roundId: round.roundId,
      bet: Number.parseInt(bet, 10),
      betType,
      ...(betType === "number" ? { number: Number.parseInt(number, 10) } : {}),
    });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    setResult(data);
    refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {[...ROULETTE_BETS, "number"].map((option) => (
          <button
            key={option}
            onClick={() => setBetType(option)}
            className={`rounded px-2.5 py-1 text-xs ${
              betType === option ? "bg-gold font-display text-night" : "bg-smoke text-ivory-dim"
            }`}
          >
            {t(`casino.rouletteBets.${option}`)}
          </button>
        ))}
        {betType === "number" && (
          <input
            type="number"
            min={0}
            max={36}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="w-16 rounded border border-gold/30 bg-night px-2 py-1 text-sm text-ivory outline-none"
          />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <BetInput bet={bet} setBet={setBet} />
        <button
          onClick={play}
          disabled={busy || !bet}
          className="rounded bg-gold px-4 py-2 font-display text-sm text-night active:scale-95 disabled:opacity-50"
        >
          {t("casino.spinButton")}
        </button>
        {result && (
          <span
            className={`font-display text-lg tabular-nums ${result.win ? "text-gold" : "text-blood-bright"}`}
          >
            {result.spin} — {result.win ? `+${result.payout}` : t("casino.lost")}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-blood-bright">{error}</p>}
      <FairnessTag hash={hash} />
    </div>
  );
}

// --- Blackjack ---

interface BjState {
  roundId: string;
  player: string[];
  playerTotal: number;
  dealerUp: string;
}

function BlackjackGame() {
  const { t, refresh, error, showError, setError, hash, setHash } = useCasino();
  const [bet, setBet] = useState("10");
  const [game, setGame] = useState<BjState | null>(null);
  const [final, setFinal] = useState<{
    result: string;
    payout: number;
    player: string[];
    dealer: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    setFinal(null);
    const round = await commit();
    if (!round) return setBusy(false);
    setHash(round.serverSeedHash);
    const { ok, data } = await postJson("/api/casino/blackjack/start", {
      roundId: round.roundId,
      bet: Number.parseInt(bet, 10),
    });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    if (data.done) {
      setFinal(data);
      setGame(null);
      refresh();
    } else {
      setGame({ roundId: round.roundId, ...data });
    }
  }

  async function act(action: "hit" | "stand" | "double") {
    if (!game) return;
    setBusy(true);
    const { ok, data } = await postJson("/api/casino/blackjack/action", {
      roundId: game.roundId,
      action,
    });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    if (data.done) {
      setFinal(data);
      setGame(null);
      refresh();
    } else {
      setGame({ ...game, player: data.player, playerTotal: data.playerTotal });
    }
  }

  const cards = final?.player ?? game?.player ?? [];
  const dealerCards = final?.dealer ?? (game ? [game.dealerUp] : []);

  return (
    <div>
      {cards.length > 0 && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-ivory-dim">{t("casino.dealerHand")}</p>
            <div className="mt-1 flex gap-1.5">
              {dealerCards.map((code, i) => (
                <PlayingCard key={`${code}${i}`} code={code} delay={i * 0.08} />
              ))}
              {game && <div className="h-16 w-11 rounded border border-gold/30 bg-smoke" />}
            </div>
          </div>
          <div>
            <p className="text-xs text-ivory-dim">
              {t("casino.yourHand")} {game ? `(${game.playerTotal})` : ""}
            </p>
            <div className="mt-1 flex gap-1.5">
              {cards.map((code, i) => (
                <PlayingCard key={`${code}${i}`} code={code} delay={i * 0.08} />
              ))}
            </div>
          </div>
        </div>
      )}

      {final && (
        <p
          className={`mt-2 font-display text-lg ${final.payout > 0 ? "text-gold" : "text-blood-bright"}`}
        >
          {t(`casino.bjResult.${final.result}`)}
          {final.payout > 0 && ` +${final.payout}`}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {!game && (
          <>
            <BetInput bet={bet} setBet={setBet} />
            <button
              onClick={start}
              disabled={busy || !bet}
              className="rounded bg-gold px-4 py-2 font-display text-sm text-night active:scale-95 disabled:opacity-50"
            >
              {t("casino.dealButton")}
            </button>
          </>
        )}
        {game && (
          <>
            <button
              onClick={() => act("hit")}
              disabled={busy}
              className="rounded bg-gold px-4 py-2 font-display text-sm text-night active:scale-95 disabled:opacity-50"
            >
              {t("casino.hit")}
            </button>
            <button
              onClick={() => act("stand")}
              disabled={busy}
              className="rounded border border-gold/40 px-4 py-2 font-display text-sm text-gold active:scale-95 disabled:opacity-50"
            >
              {t("casino.stand")}
            </button>
            {game.player.length === 2 && (
              <button
                onClick={() => act("double")}
                disabled={busy}
                className="rounded border border-blood px-4 py-2 font-display text-sm text-blood-bright active:scale-95 disabled:opacity-50"
              >
                {t("casino.double")}
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-blood-bright">{error}</p>}
      <FairnessTag hash={hash} />
    </div>
  );
}

// --- Video poker: Jacks or Better ---

function VideoPokerGame() {
  const { t, refresh, error, showError, setError, hash, setHash } = useCasino();
  const [bet, setBet] = useState("10");
  const [roundId, setRoundId] = useState<string | null>(null);
  const [cards, setCards] = useState<string[]>([]);
  const [holds, setHolds] = useState<boolean[]>([false, false, false, false, false]);
  const [final, setFinal] = useState<{ hand: string; payout: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function deal() {
    setBusy(true);
    setError(null);
    setFinal(null);
    setHolds([false, false, false, false, false]);
    const round = await commit();
    if (!round) return setBusy(false);
    setHash(round.serverSeedHash);
    const { ok, data } = await postJson("/api/casino/videopoker/deal", {
      roundId: round.roundId,
      bet: Number.parseInt(bet, 10),
    });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    setRoundId(round.roundId);
    setCards(data.cards);
  }

  async function draw() {
    if (!roundId) return;
    setBusy(true);
    const { ok, data } = await postJson("/api/casino/videopoker/draw", { roundId, holds });
    setBusy(false);
    if (!ok) return showError(data.error ?? "invalid_input");
    setCards(data.cards);
    setFinal(data);
    setRoundId(null);
    refresh();
  }

  return (
    <div>
      {cards.length > 0 && (
        <div className="flex gap-1.5">
          {cards.map((code, index) => (
            <PlayingCard
              key={`${code}${index}`}
              code={code}
              delay={index * 0.08}
              held={roundId ? holds[index] : undefined}
              onClick={
                roundId
                  ? () =>
                      setHolds((current) =>
                        current.map((held, i) => (i === index ? !held : held)),
                      )
                  : undefined
              }
            />
          ))}
        </div>
      )}
      {roundId && <p className="mt-1.5 text-xs text-ivory-dim">{t("casino.holdHint")}</p>}

      {final && (
        <p
          className={`mt-2 font-display text-lg ${final.payout > 0 ? "text-gold" : "text-blood-bright"}`}
        >
          {t(`casino.vpHands.${final.hand}`)}
          {final.payout > 0 ? ` +${final.payout}` : ""}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {!roundId ? (
          <>
            <BetInput bet={bet} setBet={setBet} />
            <button
              onClick={deal}
              disabled={busy || !bet}
              className="rounded bg-gold px-4 py-2 font-display text-sm text-night active:scale-95 disabled:opacity-50"
            >
              {t("casino.dealButton")}
            </button>
          </>
        ) : (
          <button
            onClick={draw}
            disabled={busy}
            className="rounded bg-gold px-4 py-2 font-display text-sm text-night active:scale-95 disabled:opacity-50"
          >
            {t("casino.drawButton")}
          </button>
        )}
      </div>

      <details className="mt-3 text-xs text-ivory-dim">
        <summary className="cursor-pointer">{t("casino.paytable")}</summary>
        <table className="mt-1 w-full">
          <tbody>
            {(
              [
                ["ROYAL_FLUSH", 250],
                ["STRAIGHT_FLUSH", 50],
                ["FOUR_OF_A_KIND", 25],
                ["FULL_HOUSE", 9],
                ["FLUSH", 6],
                ["STRAIGHT", 4],
                ["THREE_OF_A_KIND", 3],
                ["TWO_PAIR", 2],
                ["JACKS_OR_BETTER", 1],
              ] as const
            ).map(([hand, multiplier]) => (
              <tr key={hand}>
                <td>{t(`casino.vpHands.${hand}`)}</td>
                <td className="text-right tabular-nums">{multiplier}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {error && <p className="mt-2 text-sm text-blood-bright">{error}</p>}
      <FairnessTag hash={hash} />
    </div>
  );
}

// --- Page ---

const GAMES: { key: GameKey; icon: typeof Dices }[] = [
  { key: "dice", icon: Dices },
  { key: "roulette", icon: CircleDot },
  { key: "blackjack", icon: Spade },
  { key: "videopoker", icon: Club },
];

export function Casino() {
  const t = useTranslations();
  const [game, setGame] = useState<GameKey>("dice");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-ivory">{t("casino.title")}</h2>
        <p className="text-sm italic text-ivory-dim">{t("casino.subtitle")}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {GAMES.map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setGame(key)}
            className={`flex flex-col items-center gap-1 rounded px-2 py-2.5 text-[0.65rem] ${
              game === key ? "bg-gold font-display text-night" : "dossier text-ivory-dim"
            }`}
          >
            <Icon size={18} />
            {t(`casino.games.${key}`)}
          </button>
        ))}
      </div>

      <section className="dossier p-4">
        {game === "dice" && <DiceGame />}
        {game === "roulette" && <RouletteGame />}
        {game === "blackjack" && <BlackjackGame />}
        {game === "videopoker" && <VideoPokerGame />}
      </section>

      <p className="text-xs text-ivory-dim">{t("casino.fairnessNote")}</p>
    </div>
  );
}
