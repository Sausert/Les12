import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, rateLimit } from "@/lib/api";

const bodySchema = z.object({ username: z.string().min(1).max(30) });

/** Boss-only: toggles a member between SOLDIER and UNDERBOSS. */
export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const membership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (!membership) return apiError(400, "no_family");
  if (membership.role !== "BOSS") return apiError(403, "not_allowed");

  const target = await db.player.findUnique({
    where: { username: parsed.data.username },
    include: { familyMember: true },
  });
  if (!target?.familyMember || target.familyMember.familyId !== membership.familyId) {
    return apiError(404, "target_not_found");
  }
  if (target.id === player.id) return apiError(400, "cannot_target_self");

  const newRole = target.familyMember.role === "UNDERBOSS" ? "SOLDIER" : "UNDERBOSS";
  await db.familyMember.update({ where: { playerId: target.id }, data: { role: newRole } });
  return json({ username: target.username, role: newRole });
}
