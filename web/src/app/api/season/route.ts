import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";

/** Current season plus the hall of fame of every closed season. */
export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const [active, past] = await Promise.all([
    db.season.findFirst({ where: { status: "ACTIVE" }, orderBy: { id: "desc" } }),
    db.seasonResult.findMany({
      orderBy: [{ seasonId: "desc" }, { position: "asc" }],
      take: 30,
    }),
  ]);

  const myTrophies = past.filter((result) => result.playerId === player.id);

  return json({
    season: active ? { id: active.id, startedAt: active.startedAt.toISOString() } : null,
    hallOfFame: past.map((result) => ({
      seasonId: result.seasonId,
      position: result.position,
      username: result.username,
      xp: result.xp,
      trophyTokenId: result.trophyTokenId,
    })),
    myTrophies: myTrophies.map((result) => ({
      seasonId: result.seasonId,
      position: result.position,
      trophyTokenId: result.trophyTokenId,
    })),
  });
}
