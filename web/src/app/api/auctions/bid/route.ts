import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { chainEnabled } from "@/lib/chain/client";
import { mintTo } from "@/lib/chain/token";
import { bidOnChain } from "@/lib/chain/auction";

const bodySchema = z.object({
  auctionId: z.string().min(1),
  amount: z.number().int().positive().max(1_000_000),
});

/**
 * Bids are funded from clean cash. On-chain mode mints the stake to the
 * bidder's wallet and escrows it in the AuctionHouse, which refunds outbid
 * players on-chain (their refund lands in their wallet, depositable at the
 * bank). Off-chain mode refunds the previous bidder's cash directly.
 */
export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const amount = BigInt(parsed.data.amount);

  const auction = await db.auction.findUnique({ where: { id: parsed.data.auctionId } });
  const now = new Date();
  if (!auction || auction.status !== "OPEN") return apiError(404, "auction_not_found");
  if (auction.endsAt <= now) return apiError(400, "auction_ended");
  if (auction.sellerId === player.id) return apiError(400, "own_auction");
  const minimum = auction.highBidderId ? auction.highBid + 1n : auction.startPrice;
  if (amount < minimum) return apiError(400, "bid_too_low");

  // Debit the stake before anything else.
  const debited = await db.player.updateMany({
    where: { id: player.id, cash: { gte: amount } },
    data: { cash: { decrement: amount } },
  });
  if (debited.count === 0) return apiError(400, "insufficient_cash");

  if (chainEnabled && auction.onchainId !== null && player.walletAddress) {
    try {
      await mintTo(player.walletAddress as Address, amount);
      await bidOnChain(player.id, auction.onchainId, amount);
    } catch (err) {
      await db.player.update({
        where: { id: player.id },
        data: { cash: { increment: amount } },
      });
      console.error("on-chain bid failed", err);
      return apiError(502, "chain_error");
    }
  }

  // Mirror the new high bid; off-chain mode refunds the outbid player here.
  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.auction.updateMany({
      where: { id: auction.id, status: "OPEN", highBid: auction.highBid },
      data: { highBid: amount, highBidderId: player.id },
    });
    if (claimed.count === 0) return false;
    if (!chainEnabled && auction.highBidderId) {
      await tx.player.update({
        where: { id: auction.highBidderId },
        data: { cash: { increment: auction.highBid } },
      });
    }
    return true;
  });
  if (!updated) return apiError(409, "conflict");

  return json({ auctionId: auction.id, highBid: amount });
}
