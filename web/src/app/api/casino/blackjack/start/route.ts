import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { SeededRng } from "@/lib/game/rng";
import { cardCode, shuffledDeck } from "@/lib/game/cards";
import { handValue, isBlackjack, settleBlackjack } from "@/lib/game/casino";
import { claimRound, debitCash, validBet } from "@/lib/server/casino";

const bodySchema = z.object({
  roundId: z.string().min(1),
  bet: z.number().int().positive(),
  clientSeed: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const bet = BigInt(parsed.data.bet);
  if (!validBet(bet)) return apiError(400, "invalid_bet");
  const clientSeed = parsed.data.clientSeed ?? "";

  const round = await db.casinoRound.findUnique({ where: { id: parsed.data.roundId } });
  if (!round || round.playerId !== player.id || round.status !== "COMMITTED") {
    return apiError(404, "round_not_found");
  }

  // The whole deck order is fixed by the committed seed.
  const deck = shuffledDeck(new SeededRng(round.serverSeed, clientSeed));
  const playerCards = [deck[0], deck[2]];
  const dealerCards = [deck[1], deck[3]];
  const deckPos = 4;

  // A natural settles immediately (dealer checks the hole card).
  if (isBlackjack(playerCards) || isBlackjack(dealerCards)) {
    const settlement = settleBlackjack(bet, playerCards, dealerCards);
    const settled = await db.$transaction(async (tx) => {
      if (!(await debitCash(tx, player.id, bet))) return "insufficient_cash" as const;
      const claimed = await claimRound(tx, round.id, player.id, "COMMITTED", "SETTLED", {
        game: "BLACKJACK",
        bet,
        clientSeed,
        payout: settlement.payout,
        outcome: {
          result: settlement.result,
          player: playerCards.map(cardCode),
          dealer: dealerCards.map(cardCode),
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
      return "ok" as const;
    });
    if (settled !== "ok") return apiError(400, settled);
    return json({
      done: true,
      result: settlement.result,
      payout: settlement.payout,
      player: playerCards.map(cardCode),
      dealer: dealerCards.map(cardCode),
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed,
    });
  }

  const started = await db.$transaction(async (tx) => {
    if (!(await debitCash(tx, player.id, bet))) return "insufficient_cash" as const;
    const claimed = await claimRound(tx, round.id, player.id, "COMMITTED", "IN_PLAY", {
      game: "BLACKJACK",
      bet,
      clientSeed,
      state: { playerCards, dealerCards, deckPos, doubled: false },
    });
    if (!claimed) return "round_not_found" as const;
    return "ok" as const;
  });
  if (started !== "ok") return apiError(400, started);

  return json({
    done: false,
    player: playerCards.map(cardCode),
    playerTotal: handValue(playerCards).total,
    dealerUp: cardCode(dealerCards[0]),
    serverSeedHash: round.serverSeedHash,
  });
}
