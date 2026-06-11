import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { BULLET_PRICE } from "@/lib/game/pvp";

const bodySchema = z.object({ amount: z.number().int().positive().max(10_000) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const amount = parsed.data.amount;
  const cost = BULLET_PRICE * BigInt(amount);

  const updated = await db.player.updateMany({
    where: { id: player.id, cash: { gte: cost } },
    data: { cash: { decrement: cost }, bullets: { increment: amount } },
  });
  if (updated.count === 0) return apiError(400, "insufficient_cash");

  const fresh = await db.player.findUniqueOrThrow({
    where: { id: player.id },
    select: { bullets: true, cash: true },
  });
  return json({ bullets: fresh.bullets, cash: fresh.cash, cost });
}
