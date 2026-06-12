import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";

/** Open and recently settled auctions. */
export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const auctions = await db.auction.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      item: { include: { itemType: { select: { key: true, category: true } } } },
      seller: { select: { username: true } },
      highBidder: { select: { username: true } },
    },
  });

  const now = Date.now();
  return json(
    auctions.map((auction) => ({
      id: auction.id,
      itemKey: auction.item.itemType.key,
      category: auction.item.itemType.category,
      seller: auction.seller.username,
      startPrice: auction.startPrice,
      highBid: auction.highBid,
      highBidder: auction.highBidder?.username ?? null,
      endsAt: auction.endsAt.toISOString(),
      status: auction.status,
      mine: auction.sellerId === player.id,
      settleable: auction.status === "OPEN" && auction.endsAt.getTime() <= now,
    })),
  );
}
