import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import {
  betrayalOutcome,
  BETRAYAL_COOLDOWN_SEC,
  BETRAYAL_EXPOSE_PCT,
  RAT_HEAT,
} from "@/lib/game/family";

/**
 * Talk to the police about your own family. The raid takes a cut of the
 * treasury and you pocket half — unless you get exposed as a rat: then you're
 * out of the family with the police breathing down your neck.
 */
export async function POST() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const membership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (!membership) return apiError(400, "no_family");

  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + BETRAYAL_COOLDOWN_SEC * 1000);
  const exposed = randomInt(0, 100) < BETRAYAL_EXPOSE_PCT;

  try {
    const result = await db.$transaction(async (tx) => {
      const claimed = await tx.cooldown.updateMany({
        where: { playerId: player.id, key: "betray", expiresAt: { lte: now } },
        data: { expiresAt: cooldownUntil },
      });
      if (claimed.count === 0) {
        try {
          await tx.cooldown.create({
            data: { playerId: player.id, key: "betray", expiresAt: cooldownUntil },
          });
        } catch {
          throw new CooldownActiveError();
        }
      }

      const family = await tx.family.findUniqueOrThrow({ where: { id: membership.familyId } });
      const outcome = betrayalOutcome(family.treasury);
      if (outcome.raid <= 0n) throw new EmptyTreasuryError();

      await tx.family.update({
        where: { id: family.id },
        data: { treasury: { decrement: outcome.raid } },
      });
      await tx.player.update({
        where: { id: player.id },
        data: {
          cash: { increment: outcome.reward },
          ...(exposed ? { heat: RAT_HEAT } : {}),
        },
      });
      if (exposed) {
        // The family finds out: the rat is out on the street.
        await tx.familyMember.delete({ where: { playerId: player.id } });
      }
      await tx.betrayal.create({
        data: {
          familyId: family.id,
          playerId: player.id,
          reward: outcome.reward,
          exposed,
        },
      });
      return outcome;
    });

    return json({ reward: result.reward, raid: result.raid, exposed });
  } catch (err) {
    if (err instanceof CooldownActiveError) return apiError(409, "cooldown_active");
    if (err instanceof EmptyTreasuryError) return apiError(400, "insufficient_treasury");
    throw err;
  }
}

class CooldownActiveError extends Error {}
class EmptyTreasuryError extends Error {}
