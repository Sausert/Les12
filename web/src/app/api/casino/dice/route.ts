import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { SeededRng } from "@/lib/game/rng";
import { resolveDice, diceWinChance } from "@/lib/game/casino";
import { claimRound, debitCash, validBet } from "@/lib/server/casino";

const bodySchema = z.object({
  roundId: z.string().min(1),
  bet: z.number().int().positive(),
  target: z.number().int().min(2).max(98),
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

  const rng = new SeededRng(round.serverSeed, clientSeed);
  const outcome = resolveDice(bet, parsed.data.target, rng.nextInt(100));

  const settled = await db.$transaction(async (tx) => {
    if (!(await debitCash(tx, player.id, bet))) return "insufficient_cash" as const;
    const claimed = await claimRound(tx, round.id, player.id, "COMMITTED", "SETTLED", {
      game: "DICE",
      bet,
      clientSeed,
      payout: outcome.payout,
      outcome: { roll: outcome.roll, target: parsed.data.target, win: outcome.win },
      settledAt: new Date(),
    });
    if (!claimed) return "round_not_found" as const;
    if (outcome.payout > 0n) {
      await tx.player.update({
        where: { id: player.id },
        data: { cash: { increment: outcome.payout } },
      });
    }
    return "ok" as const;
  });
  if (settled !== "ok") return apiError(400, settled);

  return json({
    roll: outcome.roll,
    target: parsed.data.target,
    winChance: diceWinChance(parsed.data.target),
    win: outcome.win,
    payout: outcome.payout,
    serverSeed: round.serverSeed,
    serverSeedHash: round.serverSeedHash,
    clientSeed,
  });
}
