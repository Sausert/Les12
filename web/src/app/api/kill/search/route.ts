import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { bulletsNeeded, SEARCH_COOLDOWN_SEC, SEARCH_VALID_SEC } from "@/lib/game/pvp";
import { effectiveBulletsNeeded } from "@/lib/game/items";
import { getBestEffects } from "@/lib/server/items";

const bodySchema = z.object({ username: z.string().min(1).max(30) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const target = await db.player.findUnique({
    where: { username: parsed.data.username },
    include: { protection: true },
  });
  if (!target || target.isDead) return apiError(404, "target_not_found");
  if (target.id === player.id) return apiError(400, "cannot_target_self");
  if (target.jailedUntil && target.jailedUntil > new Date())
    return apiError(400, "target_in_custody");

  const now = new Date();
  const cooldownKey = "kill_search";
  const cooldownUntil = new Date(now.getTime() + SEARCH_COOLDOWN_SEC * 1000);
  const foundUntil = new Date(now.getTime() + SEARCH_VALID_SEC * 1000);

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.cooldown.updateMany({
        where: { playerId: player.id, key: cooldownKey, expiresAt: { lte: now } },
        data: { expiresAt: cooldownUntil },
      });
      if (claimed.count === 0) {
        try {
          await tx.cooldown.create({
            data: { playerId: player.id, key: cooldownKey, expiresAt: cooldownUntil },
          });
        } catch {
          throw new CooldownActiveError();
        }
      }
      await tx.search.upsert({
        where: { seekerId_targetId: { seekerId: player.id, targetId: target.id } },
        update: { expiresAt: foundUntil },
        create: { seekerId: player.id, targetId: target.id, expiresAt: foundUntil },
      });
    });
  } catch (err) {
    if (err instanceof CooldownActiveError) return apiError(409, "cooldown_active");
    throw err;
  }

  const isProtected = Boolean(target.protection && target.protection.expiresAt > now);
  const { weaponPct } = await getBestEffects(player.id);
  return json({
    target: {
      username: target.username,
      rankId: target.rankId,
      isProtected,
      bulletsNeeded: effectiveBulletsNeeded(bulletsNeeded(target.rankId, isProtected), weaponPct),
    },
    foundUntil: foundUntil.toISOString(),
    searchCooldownUntil: cooldownUntil.toISOString(),
  });
}

class CooldownActiveError extends Error {}
