import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { buyCost, carryCap, sellGain, spotPrice } from "@/lib/game/market";

/** The smuggling market of my current district, plus my contraband. */
export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const [pools, inventory, district] = await Promise.all([
    db.marketPool.findMany({ where: { districtId: player.districtId } }),
    db.inventory.findMany({ where: { playerId: player.id } }),
    db.district.findUnique({ where: { id: player.districtId } }),
  ]);
  const invByKey = new Map(inventory.map((row) => [row.goodsKey, row.qty]));

  return json({
    districtKey: district?.key ?? null,
    carryCap: carryCap(player.rankId),
    goods: pools
      .sort((a, b) => a.goodsKey.localeCompare(b.goodsKey))
      .map((pool) => ({
        goodsKey: pool.goodsKey,
        spotPrice: spotPrice(pool.goodsReserve, pool.cashReserve),
        buyOne: pool.goodsReserve > 1n ? buyCost(pool.goodsReserve, pool.cashReserve, 1n) : null,
        sellOne: sellGain(pool.goodsReserve, pool.cashReserve, 1n),
        stock: pool.goodsReserve,
        owned: invByKey.get(pool.goodsKey) ?? 0,
      })),
  });
}
