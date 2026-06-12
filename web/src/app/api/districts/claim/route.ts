import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { canManage, DISTRICT_CLAIM_COST } from "@/lib/game/family";

const bodySchema = z.object({ districtId: z.number().int().min(1) });

/** Claim an unowned district for the family (leadership, paid from the vault). */
export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const membership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (!membership) return apiError(400, "no_family");
  if (!canManage(membership.role)) return apiError(403, "not_allowed");

  const result = await db.$transaction(async (tx) => {
    const debited = await tx.family.updateMany({
      where: { id: membership.familyId, treasury: { gte: DISTRICT_CLAIM_COST } },
      data: { treasury: { decrement: DISTRICT_CLAIM_COST } },
    });
    if (debited.count === 0) return "insufficient_treasury" as const;

    // Atomic claim: only succeeds while the district is still unowned.
    const claimed = await tx.district.updateMany({
      where: { id: parsed.data.districtId, ownerFamilyId: null },
      data: { ownerFamilyId: membership.familyId, claimedAt: new Date() },
    });
    if (claimed.count === 0) {
      await tx.family.update({
        where: { id: membership.familyId },
        data: { treasury: { increment: DISTRICT_CLAIM_COST } },
      });
      return "district_owned" as const;
    }
    return "ok" as const;
  });

  if (result !== "ok") return apiError(400, result);
  return json({ claimed: parsed.data.districtId, cost: DISTRICT_CLAIM_COST });
}
