import { NextResponse } from "next/server";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { createCommittedRound } from "@/lib/server/casino";

/** Step 1 of every casino game: get the server-seed hash before betting. */
export async function POST() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const round = await createCommittedRound(player.id);
  return json({ roundId: round.id, serverSeedHash: round.serverSeedHash }, { status: 201 });
}
