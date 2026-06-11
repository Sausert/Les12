import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { BREAKOUT_SUCCESS_PCT, BREAKOUT_FAIL_JAIL_SEC } from "@/lib/game/pvp";

const bodySchema = z.object({ username: z.string().min(1).max(30) });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const inmate = await db.player.findUnique({ where: { username: parsed.data.username } });
  const now = new Date();
  if (!inmate || inmate.isDead) return apiError(404, "target_not_found");
  if (inmate.id === player.id) return apiError(400, "cannot_target_self");
  if (!inmate.jailedUntil || inmate.jailedUntil <= now) return apiError(400, "not_jailed");

  const success = randomInt(0, 100) < BREAKOUT_SUCCESS_PCT;

  if (success) {
    await db.$transaction([
      db.player.update({ where: { id: inmate.id }, data: { jailedUntil: null } }),
      db.jailEvent.updateMany({
        where: { playerId: inmate.id, until: { gt: now }, freedBy: null },
        data: { freedBy: "BREAKOUT" },
      }),
    ]);
    return json({ success: true });
  }

  // Caught in the act: the would-be liberator joins the inmate.
  const until = new Date(now.getTime() + BREAKOUT_FAIL_JAIL_SEC * 1000);
  await db.$transaction([
    db.player.update({ where: { id: player.id }, data: { jailedUntil: until } }),
    db.jailEvent.create({
      data: { playerId: player.id, reason: "BREAKOUT_FAILED", until },
    }),
  ]);
  return json({ success: false, jailedUntil: until.toISOString() });
}
