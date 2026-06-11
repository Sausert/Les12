import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { resolveDueWars } from "@/lib/server/wars";

/** My family overview, or my open invites when I have no family. */
export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  await resolveDueWars();

  const membership = await db.familyMember.findUnique({
    where: { playerId: player.id },
  });

  if (!membership) {
    const invites = await db.familyInvite.findMany({
      where: { playerId: player.id },
      include: { family: { select: { name: true } } },
    });
    return json({
      family: null,
      invites: invites.map((invite) => ({
        id: invite.id,
        familyName: invite.family.name,
      })),
    });
  }

  const [family, members, districts, wars, heists, betrayals] = await Promise.all([
    db.family.findUniqueOrThrow({ where: { id: membership.familyId } }),
    db.familyMember.findMany({
      where: { familyId: membership.familyId },
      include: { player: { select: { username: true, rank: { select: { key: true } }, isDead: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.district.findMany({ where: { ownerFamilyId: membership.familyId } }),
    db.turfWar.findMany({
      where: {
        status: "PENDING",
        OR: [{ attackerFamilyId: membership.familyId }, { defenderFamilyId: membership.familyId }],
      },
      include: { district: { select: { key: true } } },
    }),
    db.heist.findMany({
      where: { familyId: membership.familyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        roles: { include: { player: { select: { username: true } } } },
      },
    }),
    db.betrayal.findMany({
      where: { familyId: membership.familyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { player: { select: { username: true } } },
    }),
  ]);

  return json({
    family: {
      id: family.id,
      name: family.name,
      treasury: family.treasury,
      myRole: membership.role,
      members: members.map((member) => ({
        username: member.player.username,
        rankKey: member.player.rank.key,
        role: member.role,
        isDead: member.player.isDead,
      })),
      districts: districts.map((district) => ({ id: district.id, key: district.key })),
      wars: wars.map((war) => ({
        id: war.id,
        districtKey: war.district.key,
        attacking: war.attackerFamilyId === membership.familyId,
        endsAt: war.endsAt.toISOString(),
      })),
      heists: heists.map((heist) => ({
        id: heist.id,
        typeKey: heist.typeKey,
        status: heist.status,
        payoutEach: heist.payoutEach,
        roles: heist.roles.map((role) => ({ role: role.role, username: role.player.username })),
        createdAt: heist.createdAt.toISOString(),
      })),
      betrayals: betrayals.map((betrayal) => ({
        id: betrayal.id,
        exposed: betrayal.exposed,
        username: betrayal.exposed ? betrayal.player.username : null,
        reward: betrayal.reward,
        at: betrayal.createdAt.toISOString(),
      })),
    },
    invites: [],
  });
}
