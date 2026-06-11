import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { canManage, TURF_WAR_COST, TURF_WAR_DURATION_SEC } from "@/lib/game/family";

const bodySchema = z.object({ districtId: z.number().int().min(1) });

/** Declare a turf war on another family's district (leadership, vault-funded). */
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

  const district = await db.district.findUnique({ where: { id: parsed.data.districtId } });
  if (!district) return apiError(404, "district_not_found");
  if (!district.ownerFamilyId) return apiError(400, "district_unowned");
  if (district.ownerFamilyId === membership.familyId) return apiError(400, "own_district");

  const existingWar = await db.turfWar.findFirst({
    where: { districtId: district.id, status: "PENDING" },
  });
  if (existingWar) return apiError(409, "war_in_progress");

  const endsAt = new Date(Date.now() + TURF_WAR_DURATION_SEC * 1000);
  const war = await db.$transaction(async (tx) => {
    const debited = await tx.family.updateMany({
      where: { id: membership.familyId, treasury: { gte: TURF_WAR_COST } },
      data: { treasury: { decrement: TURF_WAR_COST } },
    });
    if (debited.count === 0) return null;
    return tx.turfWar.create({
      data: {
        districtId: district.id,
        attackerFamilyId: membership.familyId,
        defenderFamilyId: district.ownerFamilyId!,
        endsAt,
      },
    });
  });
  if (!war) return apiError(400, "insufficient_treasury");

  return json({ id: war.id, endsAt: endsAt.toISOString(), cost: TURF_WAR_COST }, { status: 201 });
}
