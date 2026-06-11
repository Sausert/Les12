import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { successChance } from "@/lib/game/crimes";

export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const [crimes, cooldowns] = await Promise.all([
    db.crime.findMany({ orderBy: { id: "asc" } }),
    db.cooldown.findMany({
      where: { playerId: player.id, expiresAt: { gt: new Date() } },
    }),
  ]);

  const cooldownByKey = new Map(cooldowns.map((c) => [c.key, c.expiresAt]));

  return json(
    crimes.map((crime) => ({
      id: crime.id,
      key: crime.key,
      minRankId: crime.minRankId,
      unlocked: player.rankId >= crime.minRankId,
      cooldownSec: crime.cooldownSec,
      successChance: successChance(crime, player.heat),
      minPayout: crime.minPayout,
      maxPayout: crime.maxPayout,
      xpReward: crime.xpReward,
      heatGain: crime.heatGain,
      cooldownUntil: cooldownByKey.get(`crime:${crime.id}`)?.toISOString() ?? null,
    })),
  );
}
