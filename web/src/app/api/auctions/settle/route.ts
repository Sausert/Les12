import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, rateLimit } from "@/lib/api";
import { chainEnabled } from "@/lib/chain/client";
import { settleOnChain } from "@/lib/chain/auction";

const bodySchema = z.object({ auctionId: z.string().min(1) });

/** Anyone may settle an ended auction (mirrors the contract's semantics). */
export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const auction = await db.auction.findUnique({
    where: { id: parsed.data.auctionId },
    include: { item: true },
  });
  const now = new Date();
  if (!auction || auction.status !== "OPEN") return apiError(404, "auction_not_found");
  if (auction.endsAt > now) return apiError(400, "auction_not_ended");

  let settleTxHash: string | null = null;
  if (chainEnabled && auction.onchainId !== null) {
    try {
      settleTxHash = await settleOnChain(player.id, auction.onchainId);
    } catch (err) {
      console.error("on-chain settle failed", err);
      return apiError(502, "chain_error");
    }
  }

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.auction.updateMany({
      where: { id: auction.id, status: "OPEN" },
      data: { status: "SETTLED", settleTxHash },
    });
    if (claimed.count === 0) return null;

    if (auction.highBidderId) {
      // Item to the winner; proceeds to the seller.
      await tx.item.update({
        where: { id: auction.itemId },
        data: { ownerId: auction.highBidderId, escrowed: false },
      });
      if (!chainEnabled || auction.onchainId === null) {
        await tx.player.update({
          where: { id: auction.sellerId },
          data: { cash: { increment: auction.highBid } },
        });
      }
      // On-chain mode pays the seller inside the contract settle call.
      return { winnerId: auction.highBidderId, amount: auction.highBid };
    }
    // Unsold: release the escrow back to the seller.
    await tx.item.update({
      where: { id: auction.itemId },
      data: { escrowed: false },
    });
    return { winnerId: null, amount: 0n };
  });
  if (!result) return apiError(409, "conflict");

  return json({
    settled: true,
    winnerId: result.winnerId,
    amount: result.amount,
    settleTxHash,
  });
}
