import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { DISTRICT_MOVE_COOLDOWN_SEC } from "@/lib/game/family";
import { effectiveTravelCooldown } from "@/lib/game/items";
import { getBestEffects } from "@/lib/server/items";

const bodySchema = z.object({ districtId: z.number().int().min(1) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const district = await db.district.findUnique({ where: { id: parsed.data.districtId } });
  if (!district) return apiError(404, "district_not_found");
  if (district.id === player.districtId) return apiError(400, "already_here");

  const now = new Date();
  // A fast car gets you across town sooner.
  const { carPct } = await getBestEffects(player.id);
  const cooldownSec = effectiveTravelCooldown(DISTRICT_MOVE_COOLDOWN_SEC, carPct);
  const cooldownUntil = new Date(now.getTime() + cooldownSec * 1000);

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.cooldown.updateMany({
        where: { playerId: player.id, key: "district_move", expiresAt: { lte: now } },
        data: { expiresAt: cooldownUntil },
      });
      if (claimed.count === 0) {
        try {
          await tx.cooldown.create({
            data: { playerId: player.id, key: "district_move", expiresAt: cooldownUntil },
          });
        } catch {
          throw new CooldownActiveError();
        }
      }
      await tx.player.update({
        where: { id: player.id },
        data: { districtId: district.id },
      });
    });
  } catch (err) {
    if (err instanceof CooldownActiveError) return apiError(409, "cooldown_active");
    throw err;
  }

  return json({ districtId: district.id, key: district.key });
}

class CooldownActiveError extends Error {}
