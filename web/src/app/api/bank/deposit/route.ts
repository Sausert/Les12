import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { chainEnabled, explorerTxUrl } from "@/lib/chain/client";
import { depositFor, onChainBalance } from "@/lib/chain/token";

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

  const balance = await onChainBalance(player.walletAddress as Address);
  if (balance < amount) return apiError(400, "insufficient_onchain_balance");

  // Burn on-chain first; only a confirmed receipt credits the off-chain balance.
  let txHash: `0x${string}`;
  try {
    txHash = await depositFor(player.id, amount);
  } catch (err) {
    console.error("deposit failed", err);
    return apiError(502, "chain_error");
  }

  const [, chainTx] = await db.$transaction([
    db.player.update({ where: { id: player.id }, data: { cash: { increment: amount } } }),
    db.chainTx.create({
      data: { playerId: player.id, kind: "DEPOSIT", amount, txHash, status: "CONFIRMED" },
    }),
  ]);

  return json({
    txHash: chainTx.txHash,
    explorerUrl: explorerTxUrl(txHash),
    amount,
    status: "CONFIRMED",
  });
}
