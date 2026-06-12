import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { canManage } from "@/lib/game/family";

const bodySchema = z.object({
  action: z.enum(["deposit", "withdraw"]),
  amount: z.number().int().positive().max(1_000_000_000),
});

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const amount = BigInt(parsed.data.amount);

  const membership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (!membership) return apiError(400, "no_family");

  if (parsed.data.action === "deposit") {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.player.updateMany({
        where: { id: player.id, cash: { gte: amount } },
        data: { cash: { decrement: amount } },
      });
      if (debited.count === 0) return null;
      return tx.family.update({
        where: { id: membership.familyId },
        data: { treasury: { increment: amount } },
        select: { treasury: true },
      });
    });
    if (!result) return apiError(400, "insufficient_cash");
    return json({ treasury: result.treasury });
  }

  // Withdrawing from the vault is for the leadership only.
  if (!canManage(membership.role)) return apiError(403, "not_allowed");
  const result = await db.$transaction(async (tx) => {
    const debited = await tx.family.updateMany({
      where: { id: membership.familyId, treasury: { gte: amount } },
      data: { treasury: { decrement: amount } },
    });
    if (debited.count === 0) return null;
    await tx.player.update({
      where: { id: player.id },
      data: { cash: { increment: amount } },
    });
    return tx.family.findUniqueOrThrow({
      where: { id: membership.familyId },
      select: { treasury: true },
    });
  });
  if (!result) return apiError(400, "insufficient_treasury");
  return json({ treasury: result.treasury });
}
