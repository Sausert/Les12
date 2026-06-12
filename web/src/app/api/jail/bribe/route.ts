import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { bribeCost } from "@/lib/game/pvp";

export async function POST() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player);
  if (blocked) return blocked;

  const now = new Date();
  if (!player.jailedUntil || player.jailedUntil <= now) return apiError(400, "not_jailed");

  const remainingSec = Math.ceil((player.jailedUntil.getTime() - now.getTime()) / 1000);
  const cost = bribeCost(remainingSec);

  const freed = await db.$transaction(async (tx) => {
    const debited = await tx.player.updateMany({
      where: { id: player.id, cash: { gte: cost } },
      data: { cash: { decrement: cost }, jailedUntil: null },
    });
    if (debited.count === 0) return false;
    await tx.jailEvent.updateMany({
      where: { playerId: player.id, until: { gt: now }, freedBy: null },
      data: { freedBy: "BRIBE" },
    });
    return true;
  });
  if (!freed) return apiError(400, "insufficient_cash");

  return json({ freed: true, cost });
}
