import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { chainEnabled, explorerTxUrl } from "@/lib/chain/client";
import { mintTo } from "@/lib/chain/token";

const bodySchema = z.object({ amount: z.number().int().positive().max(1_000_000) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player);
  if (blocked) return blocked;
  if (!chainEnabled) return apiError(503, "chain_disabled");
  if (!player.walletAddress) return apiError(400, "no_wallet");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const amount = BigInt(parsed.data.amount);

  // Debit off-chain first, atomically, before anything touches the chain.
  const chainTx = await db.$transaction(async (tx) => {
    const debited = await tx.player.updateMany({
      where: { id: player.id, cash: { gte: amount } },
      data: { cash: { decrement: amount } },
    });
    if (debited.count === 0) return null;
    return tx.chainTx.create({
      data: { playerId: player.id, kind: "WITHDRAW", amount },
    });
  });
  if (!chainTx) return apiError(400, "insufficient_cash");

  try {
    const txHash = await mintTo(player.walletAddress as Address, amount);
    await db.chainTx.update({
      where: { id: chainTx.id },
      data: { txHash, status: "CONFIRMED" },
    });
    return json({
      txHash,
      explorerUrl: explorerTxUrl(txHash),
      amount,
      status: "CONFIRMED",
    });
  } catch (err) {
    // Refund the off-chain balance if the mint never landed.
    await db.$transaction([
      db.player.update({ where: { id: player.id }, data: { cash: { increment: amount } } }),
      db.chainTx.update({ where: { id: chainTx.id }, data: { status: "FAILED" } }),
    ]);
    console.error("withdraw failed", err);
    return apiError(502, "chain_error");
  }
}
