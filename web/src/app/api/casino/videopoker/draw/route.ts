import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { SeededRng } from "@/lib/game/rng";
import { cardCode, shuffledDeck } from "@/lib/game/cards";
import { evaluateVideoPoker, videoPokerPayout } from "@/lib/game/casino";
import { claimRound } from "@/lib/server/casino";

const bodySchema = z.object({
  roundId: z.string().min(1),
  holds: z.array(z.boolean()).length(5),
});

/** Jacks or Better, step 2: hold any cards, draw replacements, settle. */
export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const round = await db.casinoRound.findUnique({ where: { id: parsed.data.roundId } });
  if (
    !round ||
    round.playerId !== player.id ||
    round.status !== "IN_PLAY" ||
    round.game !== "VIDEO_POKER" ||
    !round.state
  ) {
    return apiError(404, "round_not_found");
  }

  const { cards } = round.state as unknown as { cards: number[] };
  const deck = shuffledDeck(new SeededRng(round.serverSeed, round.clientSeed ?? ""));

  // Replacements come sequentially from position 5 of the committed deck.
  let drawPos = 5;
  const finalCards = cards.map((card, index) => {
    if (parsed.data.holds[index]) return card;
    const replacement = deck[drawPos];
    drawPos += 1;
    return replacement;
  });

  const hand = evaluateVideoPoker(finalCards);
  const payout = videoPokerPayout(round.bet, hand);

  const settled = await db.$transaction(async (tx) => {
    const claimed = await claimRound(tx, round.id, player.id, "IN_PLAY", "SETTLED", {
      payout,
      outcome: { hand, cards: finalCards.map(cardCode), holds: parsed.data.holds },
      settledAt: new Date(),
    });
    if (!claimed) return false;
    if (payout > 0n) {
      await tx.player.update({
        where: { id: player.id },
        data: { cash: { increment: payout } },
      });
    }
    return true;
  });
  if (!settled) return apiError(404, "round_not_found");

  return json({
    cards: finalCards.map(cardCode),
    hand,
    payout,
    serverSeed: round.serverSeed,
    serverSeedHash: round.serverSeedHash,
    clientSeed: round.clientSeed ?? "",
  });
}
