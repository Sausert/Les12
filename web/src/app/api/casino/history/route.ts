import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";

/** My settled rounds with revealed seeds, so every outcome can be verified. */
export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const rounds = await db.casinoRound.findMany({
    where: { playerId: player.id, status: "SETTLED" },
    orderBy: { settledAt: "desc" },
    take: 25,
  });

  return json(
    rounds.map((round) => ({
      id: round.id,
      game: round.game,
      bet: round.bet,
      payout: round.payout,
      outcome: round.outcome,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      settledAt: round.settledAt?.toISOString(),
    })),
  );
}
