import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { accruedYield, yieldClaimCutoff } from "@/lib/game/items";

/** Collects the accrued rent of all owned properties as clean cash. */
export async function POST() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player);
  if (blocked) return blocked;

  const now = new Date();
  const total = await db.$transaction(async (tx) => {
    const properties = await tx.item.findMany({
      where: { ownerId: player.id, escrowed: false, itemType: { yieldPerDay: { gt: 0 } } },
      include: { itemType: { select: { yieldPerDay: true } } },
    });

    let sum = 0n;
    for (const property of properties) {
      const amount = accruedYield(property.lastYieldAt, now, property.itemType.yieldPerDay);
      if (amount <= 0n) continue;
      // Guarded on lastYieldAt so a parallel claim can't double-collect.
      const claimed = await tx.item.updateMany({
        where: { id: property.id, lastYieldAt: property.lastYieldAt },
        data: { lastYieldAt: yieldClaimCutoff(property.lastYieldAt, now) },
      });
      if (claimed.count === 1) sum += amount;
    }
    if (sum > 0n) {
      await tx.player.update({
        where: { id: player.id },
        data: { cash: { increment: sum } },
      });
    }
    return sum;
  });

  if (total === 0n) return apiError(400, "nothing_to_claim");
  return json({ claimed: total });
}
