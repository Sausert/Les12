import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";

const bodySchema = z.object({ inviteId: z.string().min(1), accept: z.boolean() });

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");

  const invite = await db.familyInvite.findUnique({
    where: { id: parsed.data.inviteId },
    include: { family: { select: { name: true } } },
  });
  if (!invite || invite.playerId !== player.id) return apiError(404, "invite_not_found");

  if (!parsed.data.accept) {
    await db.familyInvite.delete({ where: { id: invite.id } });
    return json({ joined: false });
  }

  const membership = await db.familyMember.findUnique({ where: { playerId: player.id } });
  if (membership) return apiError(400, "already_in_family");

  await db.$transaction(async (tx) => {
    await tx.familyMember.create({
      data: { playerId: player.id, familyId: invite.familyId, role: "SOLDIER" },
    });
    await tx.familyInvite.deleteMany({ where: { playerId: player.id } });
  });

  return json({ joined: true, familyName: invite.family.name });
}
