import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { FAMILY_CREATE_COST, FAMILY_MIN_RANK } from "@/lib/game/family";

const bodySchema = z.object({
  name: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_ ]+$/),
});

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const name = parsed.data.name.trim();

  if (player.rankId < FAMILY_MIN_RANK) return apiError(403, "rank_too_low");

  const existingMembership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (existingMembership) return apiError(400, "already_in_family");

  const nameTaken = await db.family.findUnique({ where: { name } });
  if (nameTaken) return apiError(409, "name_taken");

  try {
    const family = await db.$transaction(async (tx) => {
      const debited = await tx.player.updateMany({
        where: { id: player.id, cash: { gte: FAMILY_CREATE_COST } },
        data: { cash: { decrement: FAMILY_CREATE_COST } },
      });
      if (debited.count === 0) return null;
      // The founding capital goes straight into the family vault.
      const created = await tx.family.create({
        data: { name, treasury: FAMILY_CREATE_COST },
      });
      await tx.familyMember.create({
        data: { playerId: player.id, familyId: created.id, role: "BOSS" },
      });
      await tx.familyInvite.deleteMany({ where: { playerId: player.id } });
      return created;
    });
    if (!family) return apiError(400, "insufficient_cash");
    return json({ id: family.id, name: family.name, treasury: family.treasury }, { status: 201 });
  } catch {
    return apiError(409, "name_taken");
  }
}
