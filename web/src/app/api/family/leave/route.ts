import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, rateLimit } from "@/lib/api";

export async function POST() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");

  const membership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (!membership) return apiError(400, "no_family");

  const memberCount = await db.familyMember.count({ where: { familyId: membership.familyId } });

  if (membership.role === "BOSS" && memberCount > 1) {
    // A boss can't walk away from a living family — promote someone first.
    return apiError(400, "boss_must_transfer");
  }

  await db.$transaction(async (tx) => {
    await tx.familyMember.delete({ where: { playerId: player.id } });
    if (memberCount === 1) {
      // Last one out turns off the lights: the family dissolves.
      await tx.familyInvite.deleteMany({ where: { familyId: membership.familyId } });
      await tx.heistRole.deleteMany({ where: { heist: { familyId: membership.familyId } } });
      await tx.heist.deleteMany({ where: { familyId: membership.familyId } });
      await tx.district.updateMany({
        where: { ownerFamilyId: membership.familyId },
        data: { ownerFamilyId: null, claimedAt: null },
      });
      await tx.turfWar.updateMany({
        where: {
          status: "PENDING",
          OR: [
            { attackerFamilyId: membership.familyId },
            { defenderFamilyId: membership.familyId },
          ],
        },
        data: { status: "RESOLVED" },
      });
      await tx.betrayal.deleteMany({ where: { familyId: membership.familyId } });
      await tx.family.delete({ where: { id: membership.familyId } });
    }
  });

  return json({ left: true, dissolved: memberCount === 1 });
}
