import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import {
  buyCost,
  carryCap,
  poolAfterBuy,
  poolAfterSell,
  sellGain,
  GOODS_KEYS,
} from "@/lib/game/market";

const bodySchema = z.object({
  goodsKey: z.enum(GOODS_KEYS),
  action: z.enum(["buy", "sell"]),
  qty: z.number().int().positive().max(1000),
});

/** Smuggling trade in the player's current district, paid in dirty cash. */
export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const { goodsKey, action } = parsed.data;
  const qty = BigInt(parsed.data.qty);

  type TradeResult =
    | { error: string }
    | { cost: bigint; qty: number }
    | { gain: bigint; qty: number };

  const result = await db.$transaction<TradeResult>(async (tx) => {
    // Lock the pool row: trades reprice sequentially, never on stale reserves.
    const pools = await tx.$queryRaw<
      { goodsReserve: bigint; cashReserve: bigint }[]
    >`SELECT "goodsReserve", "cashReserve" FROM "MarketPool"
      WHERE "districtId" = ${player.districtId} AND "goodsKey" = ${goodsKey} FOR UPDATE`;
    const pool = pools[0];
    if (!pool) return { error: "no_market" as const };

    if (action === "buy") {
      if (qty >= pool.goodsReserve) return { error: "insufficient_stock" as const };
      const inventory = await tx.inventory.findUnique({
        where: { playerId_goodsKey: { playerId: player.id, goodsKey } },
      });
      const cap = carryCap(player.rankId);
      if ((inventory?.qty ?? 0) + parsed.data.qty > cap) {
        return { error: "carry_cap" as const };
      }

      const cost = buyCost(pool.goodsReserve, pool.cashReserve, qty);
      const debited = await tx.player.updateMany({
        where: { id: player.id, dirtyCash: { gte: cost } },
        data: { dirtyCash: { decrement: cost } },
      });
      if (debited.count === 0) return { error: "insufficient_dirty_cash" as const };

      const after = poolAfterBuy(pool.goodsReserve, pool.cashReserve, qty);
      await tx.marketPool.update({
        where: { districtId_goodsKey: { districtId: player.districtId, goodsKey } },
        data: { goodsReserve: after.goodsReserve, cashReserve: after.cashReserve },
      });
      await tx.inventory.upsert({
        where: { playerId_goodsKey: { playerId: player.id, goodsKey } },
        update: { qty: { increment: parsed.data.qty } },
        create: { playerId: player.id, goodsKey, qty: parsed.data.qty },
      });
      return { cost, qty: parsed.data.qty };
    }

    // Sell: hand over the goods, pocket dirty cash.
    const sold = await tx.inventory.updateMany({
      where: { playerId: player.id, goodsKey, qty: { gte: parsed.data.qty } },
      data: { qty: { decrement: parsed.data.qty } },
    });
    if (sold.count === 0) return { error: "insufficient_goods" as const };

    const gain = sellGain(pool.goodsReserve, pool.cashReserve, qty);
    const after = poolAfterSell(pool.goodsReserve, pool.cashReserve, qty);
    await tx.marketPool.update({
      where: { districtId_goodsKey: { districtId: player.districtId, goodsKey } },
      data: { goodsReserve: after.goodsReserve, cashReserve: after.cashReserve },
    });
    await tx.player.update({
      where: { id: player.id },
      data: { dirtyCash: { increment: gain } },
    });
    return { gain, qty: parsed.data.qty };
  });

  if ("error" in result) return apiError(400, result.error);
  return json(result);
}
