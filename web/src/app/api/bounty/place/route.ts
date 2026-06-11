import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { chainEnabled } from "@/lib/chain/client";
import { fundBountyOnChain } from "@/lib/chain/bounty";

const bodySchema = z.object({
  username: z.string().min(1).max(30),
  amount: z.number().int().positive().max(1_000_000),
});

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const amount = BigInt(parsed.data.amount);

  const target = await db.player.findUnique({ where: { username: parsed.data.username } });
  if (!target || target.isDead) return apiError(404, "target_not_found");
  if (target.id === player.id) return apiError(400, "cannot_target_self");

  // Debit clean cash first; the escrow is funded only after a successful debit.
  const order = await db.$transaction(async (tx) => {
    const debited = await tx.player.updateMany({
      where: { id: player.id, cash: { gte: amount } },
      data: { cash: { decrement: amount } },
    });
    if (debited.count === 0) return null;
    return tx.bountyOrder.create({
      data: { placerId: player.id, targetId: target.id, amount },
    });
  });
  if (!order) return apiError(400, "insufficient_cash");

  let fundTxHash: string | null = null;
  if (chainEnabled && target.walletAddress) {
    try {
      fundTxHash = await fundBountyOnChain(target.walletAddress as Address, amount);
      await db.bountyOrder.update({ where: { id: order.id }, data: { fundTxHash } });
    } catch (err) {
      // Refund: the escrow never got funded.
      await db.$transaction([
        db.player.update({ where: { id: player.id }, data: { cash: { increment: amount } } }),
        db.bountyOrder.delete({ where: { id: order.id } }),
      ]);
      console.error("bounty funding failed", err);
      return apiError(502, "chain_error");
    }
  }

  return json({ id: order.id, target: target.username, amount, fundTxHash }, { status: 201 });
}
