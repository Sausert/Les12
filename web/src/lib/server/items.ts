import { db } from "@/lib/db";
import { bestEffect } from "@/lib/game/items";

/** Best weapon/car effect a player owns (escrowed items don't help you). */
export async function getBestEffects(
  playerId: string,
): Promise<{ weaponPct: number; carPct: number }> {
  const items = await db.item.findMany({
    where: { ownerId: playerId, escrowed: false },
    select: { itemType: { select: { category: true, effectPct: true } } },
  });
  return {
    weaponPct: bestEffect(
      items.filter((i) => i.itemType.category === "WEAPON").map((i) => i.itemType.effectPct),
    ),
    carPct: bestEffect(
      items.filter((i) => i.itemType.category === "CAR").map((i) => i.itemType.effectPct),
    ),
  };
}
