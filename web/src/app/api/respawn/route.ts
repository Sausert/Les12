import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, rateLimit } from "@/lib/api";
import { rankForXp } from "@/lib/game/ranks";
import { witnessProtectionOutcome } from "@/lib/game/pvp";

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fresh") }),
  z.object({
    mode: z.literal("witness"),
    newUsername: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/),
  }),
]);

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  if (!player.isDead) return apiError(400, "not_dead");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const body = parsed.data;

  const revivedBase = {
    isDead: false,
    diedAt: null,
    heat: 0,
    bullets: 0,
  };

  if (body.mode === "fresh") {
    // Back to the bottom: name and remaining cash survive, the reputation doesn't.
    await db.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: player.id },
        data: { ...revivedBase, xp: 0n, rankId: 1 },
      });
      await tx.protection.deleteMany({ where: { playerId: player.id } });
      await tx.search.deleteMany({ where: { targetId: player.id } });
    });
    return json({ mode: "fresh", username: player.username, xp: 0 });
  }

  // Witness protection: a new identity, most of the experience, for a price.
  const outcome = witnessProtectionOutcome(player.xp);
  const taken = await db.player.findUnique({ where: { username: body.newUsername } });
  if (taken) return apiError(409, "username_taken");

  try {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.player.updateMany({
        where: { id: player.id, cash: { gte: outcome.cost } },
        data: { cash: { decrement: outcome.cost } },
      });
      if (debited.count === 0) return null;

      const ranks = await tx.rank.findMany({ orderBy: { id: "asc" } });
      const newRank = rankForXp(ranks, outcome.xpKept);
      await tx.player.update({
        where: { id: player.id },
        data: {
          ...revivedBase,
          username: body.newUsername,
          xp: outcome.xpKept,
          rankId: newRank.id,
        },
      });
      await tx.protection.deleteMany({ where: { playerId: player.id } });
      await tx.search.deleteMany({ where: { targetId: player.id } });
      // Open bounties die with the old identity: nobody knows the new face.
      await tx.bountyOrder.updateMany({
        where: { targetId: player.id, status: "OPEN" },
        data: { status: "CLAIMED", claimedById: null },
      });
      await tx.identityChange.create({
        data: {
          playerId: player.id,
          oldUsername: player.username,
          newUsername: body.newUsername,
          xpKept: outcome.xpKept,
          cost: outcome.cost,
        },
      });
      return { newRankKey: newRank.key };
    });
    if (!result) return apiError(400, "insufficient_cash");

    return json({
      mode: "witness",
      username: body.newUsername,
      xp: outcome.xpKept,
      cost: outcome.cost,
      rankKey: result.newRankKey,
    });
  } catch {
    return apiError(409, "username_taken");
  }
}
