import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { PROTECTION_PRICE, PROTECTION_HOURS } from "@/lib/game/pvp";

export async function POST() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const expiresAt = new Date(Date.now() + PROTECTION_HOURS * 3600 * 1000);

  try {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.player.updateMany({
        where: { id: player.id, cash: { gte: PROTECTION_PRICE } },
        data: { cash: { decrement: PROTECTION_PRICE } },
      });
      if (debited.count === 0) return null;
      await tx.protection.upsert({
        where: { playerId: player.id },
        update: { expiresAt },
        create: { playerId: player.id, expiresAt },
      });
      return expiresAt;
    });
    if (!result) return apiError(400, "insufficient_cash");
    return json({ protectedUntil: result.toISOString(), cost: PROTECTION_PRICE });
  } catch {
    return apiError(409, "conflict");
  }
}
