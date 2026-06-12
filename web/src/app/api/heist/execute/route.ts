import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { applyHeat } from "@/lib/game/crimes";
import { rankForXp } from "@/lib/game/ranks";
import { heistType, resolveHeist, HEIST_ROLES, HEIST_COOLDOWN_SEC } from "@/lib/game/heists";

const bodySchema = z.object({ heistId: z.string().min(1) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const heist = await db.heist.findUnique({
    where: { id: parsed.data.heistId },
    include: { roles: { include: { player: { select: { id: true, rankId: true, xp: true, heat: true } } } } },
  });
  if (!heist || heist.status !== "OPEN") return apiError(404, "heist_not_found");
  if (!heist.roles.some((role) => role.playerId === player.id)) {
    return apiError(403, "not_allowed");
  }
  if (heist.roles.length < HEIST_ROLES.length) return apiError(400, "crew_incomplete");

  const type = heistType(heist.typeKey);
  if (!type) return apiError(404, "heist_not_found");

  const crewRankIds = heist.roles.map((role) => role.player.rankId);
  const roll = randomInt(0, 100);
  const payoutRoll = randomInt(0, 1_000_000) / 1_000_000;
  const outcome = resolveHeist(type, crewRankIds, roll, payoutRoll);

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    // Single execution guard: the status flip only succeeds once.
    const claimed = await tx.heist.updateMany({
      where: { id: heist.id, status: "OPEN" },
      data: {
        status: outcome.success ? "SUCCESS" : "FAILED",
        payoutEach: outcome.payoutEach,
        executedAt: now,
      },
    });
    if (claimed.count === 0) return null;

    const ranks = await tx.rank.findMany({ orderBy: { id: "asc" } });
    const cooldownUntil = new Date(now.getTime() + HEIST_COOLDOWN_SEC * 1000);
    for (const role of heist.roles) {
      const newXp = role.player.xp + BigInt(outcome.xpEach);
      await tx.player.update({
        where: { id: role.playerId },
        data: {
          dirtyCash: { increment: outcome.payoutEach },
          xp: newXp,
          rankId: rankForXp(ranks, newXp).id,
          heat: applyHeat(role.player.heat, outcome.heatEach),
        },
      });
      await tx.cooldown.upsert({
        where: { playerId_key: { playerId: role.playerId, key: "heist" } },
        update: { expiresAt: cooldownUntil },
        create: { playerId: role.playerId, key: "heist", expiresAt: cooldownUntil },
      });
    }
    return outcome;
  });
  if (!result) return apiError(409, "conflict");

  return json({
    success: result.success,
    payoutEach: result.payoutEach,
    xpEach: result.xpEach,
    heatEach: result.heatEach,
    crew: heist.roles.length,
  });
}
