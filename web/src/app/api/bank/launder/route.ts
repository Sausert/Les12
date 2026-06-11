import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, rateLimit } from "@/lib/api";
import { resolveLaunder, LAUNDER_FEE_PCT } from "@/lib/game/bank";

const bodySchema = z.object({ amount: z.number().int().positive().max(1_000_000_000) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const amount = BigInt(parsed.data.amount);

  const outcome = resolveLaunder(amount, player.heat);

  // Guarded decrement: only succeeds if the dirty balance still covers it.
  const result = await db.$transaction(async (tx) => {
    const debited = await tx.player.updateMany({
      where: { id: player.id, dirtyCash: { gte: amount } },
      data: { dirtyCash: { decrement: amount } },
    });
    if (debited.count === 0) return null;
    return tx.player.update({
      where: { id: player.id },
      data: {
        cash: { increment: outcome.cleanGained },
        heat: Math.max(0, player.heat - outcome.heatReduction),
      },
      select: { cash: true, dirtyCash: true, heat: true },
    });
  });
  if (!result) return apiError(400, "insufficient_dirty_cash");

  return json({
    laundered: amount,
    cleanGained: outcome.cleanGained,
    fee: outcome.fee,
    feePct: LAUNDER_FEE_PCT,
    cash: result.cash,
    dirtyCash: result.dirtyCash,
    heat: result.heat,
  });
}
