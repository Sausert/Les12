import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { chainEnabled, explorerTxUrl } from "@/lib/chain/client";
import { mintItemTo } from "@/lib/chain/items";

const bodySchema = z.object({ typeKey: z.string().min(1) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const itemType = await db.itemType.findUnique({ where: { key: parsed.data.typeKey } });
  if (!itemType) return apiError(404, "item_not_found");

  // Pay first; the registry row exists before any chain call.
  const item = await db.$transaction(async (tx) => {
    const debited = await tx.player.updateMany({
      where: { id: player.id, cash: { gte: itemType.price } },
      data: { cash: { decrement: itemType.price } },
    });
    if (debited.count === 0) return null;
    return tx.item.create({ data: { itemTypeId: itemType.id, ownerId: player.id } });
  });
  if (!item) return apiError(400, "insufficient_cash");

  let tokenId: bigint | null = null;
  let mintTxHash: string | null = null;
  if (chainEnabled && player.walletAddress) {
    try {
      const minted = await mintItemTo(
        player.walletAddress as Address,
        itemType.id,
        `/nft/${itemType.key}.json`,
      );
      tokenId = minted.tokenId;
      mintTxHash = minted.txHash;
      await db.item.update({ where: { id: item.id }, data: { tokenId, mintTxHash } });
    } catch (err) {
      // Refund: the registry purchase never completed on-chain.
      await db.$transaction([
        db.player.update({
          where: { id: player.id },
          data: { cash: { increment: itemType.price } },
        }),
        db.item.delete({ where: { id: item.id } }),
      ]);
      console.error("item mint failed", err);
      return apiError(502, "chain_error");
    }
  }

  return json(
    {
      id: item.id,
      key: itemType.key,
      tokenId,
      mintTxHash,
      explorerUrl: mintTxHash ? explorerTxUrl(mintTxHash) : null,
    },
    { status: 201 },
  );
}
