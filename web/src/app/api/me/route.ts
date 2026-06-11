import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { rankProgress } from "@/lib/game/ranks";
import { bribeCost, WITNESS_PROTECTION_COST, WITNESS_XP_KEPT_PCT } from "@/lib/game/pvp";

export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  const now = new Date();
  const [rank, ranks, cooldowns, protection, bountyOnMe, membership, district] = await Promise.all([
    db.rank.findUniqueOrThrow({ where: { id: player.rankId } }),
    db.rank.findMany({ orderBy: { id: "asc" } }),
    db.cooldown.findMany({
      where: { playerId: player.id, expiresAt: { gt: now } },
    }),
    db.protection.findUnique({ where: { playerId: player.id } }),
    db.bountyOrder.aggregate({
      where: { targetId: player.id, status: "OPEN" },
      _sum: { amount: true },
    }),
    db.familyMember.findUnique({
      where: { playerId: player.id },
      include: { family: { select: { name: true } } },
    }),
    db.district.findUnique({ where: { id: player.districtId } }),
  ]);

  const jailed = player.jailedUntil && player.jailedUntil > now ? player.jailedUntil : null;
  const nextRank = ranks.find((r) => r.id === rank.id + 1) ?? null;

  return json({
    id: player.id,
    username: player.username,
    locale: player.locale,
    xp: player.xp,
    cash: player.cash,
    dirtyCash: player.dirtyCash,
    heat: player.heat,
    bullets: player.bullets,
    isDead: player.isDead,
    jailedUntil: jailed?.toISOString() ?? null,
    bribeCost: jailed ? bribeCost(Math.ceil((jailed.getTime() - now.getTime()) / 1000)) : null,
    protectedUntil:
      protection && protection.expiresAt > now ? protection.expiresAt.toISOString() : null,
    bountyOnMe: bountyOnMe._sum.amount ?? 0n,
    walletAddress: player.walletAddress,
    family: membership
      ? { name: membership.family.name, role: membership.role }
      : null,
    district: district ? { id: district.id, key: district.key } : null,
    rank: { id: rank.id, key: rank.key },
    rankProgress: rankProgress(ranks, player.xp),
    nextRank: nextRank ? { key: nextRank.key, minXp: nextRank.minXp } : null,
    witnessProtection: { cost: WITNESS_PROTECTION_COST, xpKeptPct: WITNESS_XP_KEPT_PCT },
    cooldowns: cooldowns.map((c) => ({ key: c.key, expiresAt: c.expiresAt.toISOString() })),
  });
}
