import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { resolveTurfWar } from "@/lib/game/family";

/**
 * Lazily resolves every pending turf war whose timer ran out. Called from the
 * district/family reads so no cron is needed: the first visitor settles it.
 */
export async function resolveDueWars(): Promise<void> {
  const due = await db.turfWar.findMany({
    where: { status: "PENDING", endsAt: { lte: new Date() } },
  });

  for (const war of due) {
    const [attackers, defenders] = await Promise.all([
      db.familyMember.findMany({
        where: { familyId: war.attackerFamilyId },
        select: { player: { select: { rankId: true } } },
      }),
      db.familyMember.findMany({
        where: { familyId: war.defenderFamilyId },
        select: { player: { select: { rankId: true } } },
      }),
    ]);

    const winner = resolveTurfWar(
      attackers.map((m) => m.player.rankId),
      defenders.map((m) => m.player.rankId),
      randomInt(0, 1_000_000) / 1_000_000,
      randomInt(0, 1_000_000) / 1_000_000,
    );
    const winnerFamilyId = winner === "ATTACKER" ? war.attackerFamilyId : war.defenderFamilyId;

    await db.$transaction(async (tx) => {
      // Only the first resolver wins the update; parallel calls become no-ops.
      const claimed = await tx.turfWar.updateMany({
        where: { id: war.id, status: "PENDING" },
        data: { status: "RESOLVED", winnerFamilyId },
      });
      if (claimed.count === 0) return;
      if (winner === "ATTACKER") {
        await tx.district.update({
          where: { id: war.districtId },
          data: { ownerFamilyId: war.attackerFamilyId, claimedAt: new Date() },
        });
      }
    });
  }
}
