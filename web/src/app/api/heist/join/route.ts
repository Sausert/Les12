import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { heistType, HEIST_ROLES } from "@/lib/game/heists";

const bodySchema = z.object({
  heistId: z.string().min(1),
  role: z.enum(HEIST_ROLES),
});

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const membership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (!membership) return apiError(400, "no_family");

  const heistCooldown = await db.cooldown.findUnique({
    where: { playerId_key: { playerId: player.id, key: "heist" } },
  });
  if (heistCooldown && heistCooldown.expiresAt > new Date()) {
    return apiError(409, "cooldown_active");
  }

  const heist = await db.heist.findUnique({ where: { id: parsed.data.heistId } });
  if (!heist || heist.status !== "OPEN" || heist.familyId !== membership.familyId) {
    return apiError(404, "heist_not_found");
  }
  const type = heistType(heist.typeKey);
  if (!type) return apiError(404, "heist_not_found");
  if (player.rankId < type.minRankId) return apiError(403, "rank_too_low");

  const openWithMe = await db.heistRole.findFirst({
    where: { playerId: player.id, heist: { status: "OPEN" } },
  });
  if (openWithMe) return apiError(400, "already_in_heist");

  try {
    // The composite PK rejects a second claim on the same role atomically.
    await db.heistRole.create({
      data: { heistId: heist.id, playerId: player.id, role: parsed.data.role },
    });
  } catch {
    return apiError(409, "role_taken");
  }

  return json({ heistId: heist.id, role: parsed.data.role });
}
