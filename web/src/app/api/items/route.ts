import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { accruedYield } from "@/lib/game/items";

/** Item catalog plus my collection and any rent waiting to be claimed. */
export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const now = new Date();
  const [types, mine] = await Promise.all([
    db.itemType.findMany({ orderBy: { id: "asc" } }),
    db.item.findMany({
      where: { ownerId: player.id },
      include: { itemType: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return json({
    catalog: types.map((type) => ({
      key: type.key,
      category: type.category,
      price: type.price,
      effectPct: type.effectPct,
      yieldPerDay: type.yieldPerDay,
    })),
    items: mine.map((item) => ({
      id: item.id,
      key: item.itemType.key,
      category: item.itemType.category,
      effectPct: item.itemType.effectPct,
      yieldPerDay: item.itemType.yieldPerDay,
      tokenId: item.tokenId,
      escrowed: item.escrowed,
      claimableYield: accruedYield(item.lastYieldAt, now, item.itemType.yieldPerDay),
    })),
  });
}
