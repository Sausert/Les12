import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { rankProgress } from "@/lib/game/ranks";

export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const [rank, ranks, cooldowns] = await Promise.all([
    db.rank.findUniqueOrThrow({ where: { id: player.rankId } }),
    db.rank.findMany({ orderBy: { id: "asc" } }),
    db.cooldown.findMany({
      where: { playerId: player.id, expiresAt: { gt: new Date() } },
    }),
  ]);

  return json({
    id: player.id,
    username: player.username,
    locale: player.locale,
    xp: player.xp,
    cash: player.cash,
    dirtyCash: player.dirtyCash,
    heat: player.heat,
    walletAddress: player.walletAddress,
    rank: { id: rank.id, key: rank.key },
    rankProgress: rankProgress(ranks, player.xp),
    nextRank: ranks.find((r) => r.id === rank.id + 1)
      ? {
          key: ranks.find((r) => r.id === rank.id + 1)!.key,
          minXp: ranks.find((r) => r.id === rank.id + 1)!.minXp,
        }
      : null,
    cooldowns: cooldowns.map((c) => ({ key: c.key, expiresAt: c.expiresAt.toISOString() })),
  });
}
