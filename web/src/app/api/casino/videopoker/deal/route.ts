import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { SeededRng } from "@/lib/game/rng";
import { cardCode, shuffledDeck } from "@/lib/game/cards";
import { claimRound, debitCash, validBet } from "@/lib/server/casino";

const bodySchema = z.object({
  roundId: z.string().min(1),
  bet: z.number().int().positive(),
  clientSeed: z.string().max(64).optional(),
});

/** Jacks or Better, step 1: bet and receive five cards from the seeded deck. */
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

  const deck = shuffledDeck(new SeededRng(round.serverSeed, clientSeed));
  const cards = deck.slice(0, 5);

  const started = await db.$transaction(async (tx) => {
    if (!(await debitCash(tx, player.id, bet))) return "insufficient_cash" as const;
    const claimed = await claimRound(tx, round.id, player.id, "COMMITTED", "IN_PLAY", {
      game: "VIDEO_POKER",
      bet,
      clientSeed,
      state: { cards },
    });
    if (!claimed) return "round_not_found" as const;
    return "ok" as const;
  });
  if (started !== "ok") return apiError(400, started);

  return json({
    cards: cards.map(cardCode),
    serverSeedHash: round.serverSeedHash,
  });
}
