import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { canManage } from "@/lib/game/family";

const bodySchema = z.object({ username: z.string().min(1).max(30) });

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

  const invitee = await db.player.findUnique({
    where: { username: parsed.data.username },
    include: { familyMember: true },
  });
  if (!invitee || invitee.isDead) return apiError(404, "target_not_found");
  if (invitee.familyMember) return apiError(400, "already_in_family");

  try {
    const invite = await db.familyInvite.create({
      data: { familyId: membership.familyId, playerId: invitee.id },
    });
    return json({ id: invite.id, username: invitee.username }, { status: 201 });
  } catch {
    return apiError(409, "already_invited");
  }
}
