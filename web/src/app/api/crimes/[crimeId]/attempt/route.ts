import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, rateLimit } from "@/lib/api";
import { applyHeat, resolveCrime } from "@/lib/game/crimes";
import { rankForXp } from "@/lib/game/ranks";

export async function POST(_request: Request, context: { params: Promise<{ crimeId: string }> }) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");

  const { crimeId: crimeIdRaw } = await context.params;
  const crimeId = Number.parseInt(crimeIdRaw, 10);
  if (!Number.isInteger(crimeId)) return apiError(400, "invalid_input");

  const crime = await db.crime.findUnique({ where: { id: crimeId } });
  if (!crime) return apiError(404, "crime_not_found");
  if (player.rankId < crime.minRankId) return apiError(403, "rank_too_low");

  // All randomness is rolled server-side; the client only sends intent.
  const roll = randomInt(0, 100);
  const payoutRoll = randomInt(0, 1_000_000) / 1_000_000;

  try {
    const result = await db.$transaction(async (tx) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + crime.cooldownSec * 1000);
      const cooldownKey = `crime:${crime.id}`;

      // Atomic cooldown claim: update only wins if the old cooldown expired;
      // create only wins if no row exists (PK conflict otherwise).
      const claimed = await tx.cooldown.updateMany({
        where: { playerId: player.id, key: cooldownKey, expiresAt: { lte: now } },
        data: { expiresAt },
      });
      if (claimed.count === 0) {
        try {
          await tx.cooldown.create({
            data: { playerId: player.id, key: cooldownKey, expiresAt },
          });
        } catch {
          throw new CooldownActiveError();
        }
      }

      const outcome = resolveCrime(crime, player.heat, roll, payoutRoll);
      const ranks = await tx.rank.findMany({ orderBy: { id: "asc" } });
      const newXp = player.xp + BigInt(outcome.xpGained);
      const newRank = rankForXp(ranks, newXp);

      await tx.player.update({
        where: { id: player.id },
        data: {
          xp: newXp,
          dirtyCash: { increment: outcome.payout },
          heat: applyHeat(player.heat, outcome.heatGained),
          rankId: newRank.id,
        },
      });
      await tx.crimeAttempt.create({
        data: {
          playerId: player.id,
          crimeId: crime.id,
          success: outcome.success,
          payout: outcome.payout,
          xpGained: outcome.xpGained,
        },
      });

      return {
        success: outcome.success,
        payout: outcome.payout,
        xpGained: outcome.xpGained,
        heat: applyHeat(player.heat, outcome.heatGained),
        cooldownUntil: expiresAt.toISOString(),
        rankUp: newRank.id > player.rankId ? { id: newRank.id, key: newRank.key } : null,
      };
    });

    return json(result);
  } catch (err) {
    if (err instanceof CooldownActiveError) return apiError(409, "cooldown_active");
    if (err instanceof Prisma.PrismaClientKnownRequestError) return apiError(409, "conflict");
    throw err;
  }
}

class CooldownActiveError extends Error {}
