import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { explorerTxUrl } from "@/lib/chain/client";

export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const txs = await db.chainTx.findMany({
    where: { playerId: player.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return json(
    txs.map((tx) => ({
      id: tx.id,
      kind: tx.kind,
      amount: tx.amount,
      txHash: tx.txHash,
      explorerUrl: tx.txHash ? explorerTxUrl(tx.txHash) : null,
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    })),
  );
}
