import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { AUCTION_MIN_DURATION_MIN, AUCTION_MAX_DURATION_MIN } from "@/lib/game/items";
import { chainEnabled } from "@/lib/chain/client";
import { createAuctionOnChain } from "@/lib/chain/auction";

const bodySchema = z.object({
  itemId: z.string().min(1),
  startPrice: z.number().int().positive().max(1_000_000),
  durationMin: z.number().int().min(AUCTION_MIN_DURATION_MIN).max(AUCTION_MAX_DURATION_MIN),
});

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const startPrice = BigInt(parsed.data.startPrice);
  const durationSec = parsed.data.durationMin * 60;
  const endsAt = new Date(Date.now() + durationSec * 1000);

  const item = await db.item.findUnique({
    where: { id: parsed.data.itemId },
    include: { itemType: { select: { key: true } } },
  });
  if (!item || item.ownerId !== player.id) return apiError(404, "item_not_found");
  if (item.escrowed) return apiError(400, "item_escrowed");

  // Escrow in the registry first; only an un-escrowed item can be listed.
  const escrowed = await db.item.updateMany({
    where: { id: item.id, escrowed: false, ownerId: player.id },
    data: { escrowed: true },
  });
  if (escrowed.count === 0) return apiError(400, "item_escrowed");

  let onchainId: bigint | null = null;
  if (chainEnabled && item.tokenId !== null) {
    try {
      const created = await createAuctionOnChain(player.id, item.tokenId, startPrice, durationSec);
      onchainId = created.auctionId;
    } catch (err) {
      await db.item.update({ where: { id: item.id }, data: { escrowed: false } });
      console.error("auction creation failed", err);
      return apiError(502, "chain_error");
    }
  }

  const auction = await db.auction.create({
    data: {
      itemId: item.id,
      sellerId: player.id,
      startPrice,
      endsAt,
      onchainId,
    },
  });

  return json(
    { id: auction.id, itemKey: item.itemType.key, startPrice, endsAt: endsAt.toISOString() },
    { status: 201 },
  );
}
