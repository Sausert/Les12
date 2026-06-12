import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { SeededRng } from "@/lib/game/rng";
import { cardCode, shuffledDeck } from "@/lib/game/cards";
import { dealerPlay, handValue, settleBlackjack } from "@/lib/game/casino";
import { claimRound, debitCash } from "@/lib/server/casino";

const bodySchema = z.object({
  roundId: z.string().min(1),
  action: z.enum(["hit", "stand", "double"]),
});

interface BlackjackState {
  playerCards: number[];
  dealerCards: number[];
  deckPos: number;
  doubled: boolean;
}

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const { action } = parsed.data;

  const round = await db.casinoRound.findUnique({ where: { id: parsed.data.roundId } });
  if (!round || round.playerId !== player.id || round.status !== "IN_PLAY" || !round.state) {
    return apiError(404, "round_not_found");
  }
  const state = round.state as unknown as BlackjackState;
  const deck = shuffledDeck(new SeededRng(round.serverSeed, round.clientSeed ?? ""));
  let { deckPos } = state;
  const playerCards = [...state.playerCards];
  let bet = round.bet;

  if (action === "double") {
    if (playerCards.length !== 2 || state.doubled) return apiError(400, "invalid_action");
  }

  const result = await db.$transaction(async (tx) => {
    if (action === "double") {
      // Double the stake for exactly one card, then the dealer plays.
      if (!(await debitCash(tx, player.id, round.bet))) return "insufficient_cash" as const;
      bet = round.bet * 2n;
      playerCards.push(deck[deckPos]);
      deckPos += 1;
    } else if (action === "hit") {
      playerCards.push(deck[deckPos]);
      deckPos += 1;
      if (handValue(playerCards).total < 21) {
        // Round continues: persist the new hand.
        const updated = await tx.casinoRound.updateMany({
          where: { id: round.id, status: "IN_PLAY" },
          data: { state: { ...state, playerCards, deckPos } },
        });
        return updated.count === 1 ? ("continue" as const) : ("round_not_found" as const);
      }
    }

    // Stand, double, 21 or bust: dealer finishes and the round settles.
    const busted = handValue(playerCards).total > 21;
    const dealer = busted
      ? { cards: state.dealerCards, deckPos }
      : dealerPlay(state.dealerCards, deck, deckPos);
    const settlement = settleBlackjack(bet, playerCards, dealer.cards);

    const claimed = await claimRound(tx, round.id, player.id, "IN_PLAY", "SETTLED", {
      bet,
      payout: settlement.payout,
      outcome: {
        result: settlement.result,
        player: playerCards.map(cardCode),
        dealer: dealer.cards.map(cardCode),
      },
      settledAt: new Date(),
    });
    if (!claimed) return "round_not_found" as const;
    if (settlement.payout > 0n) {
      await tx.player.update({
        where: { id: player.id },
        data: { cash: { increment: settlement.payout } },
      });
    }
    return { settlement, dealerCards: dealer.cards };
  });

  if (result === "insufficient_cash" || result === "round_not_found") {
    return apiError(400, result);
  }
  if (result === "continue") {
    return json({
      done: false,
      player: playerCards.map(cardCode),
      playerTotal: handValue(playerCards).total,
    });
  }

  return json({
    done: true,
    result: result.settlement.result,
    payout: result.settlement.payout,
    player: playerCards.map(cardCode),
    playerTotal: handValue(playerCards).total,
    dealer: result.dealerCards.map(cardCode),
    dealerTotal: handValue(result.dealerCards).total,
    serverSeed: round.serverSeed,
    serverSeedHash: round.serverSeedHash,
    clientSeed: round.clientSeed ?? "",
  });
}
