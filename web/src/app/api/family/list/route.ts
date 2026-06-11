import { db } from "@/lib/db";
import { json } from "@/lib/api";

/** Family leaderboard: ranked by combined member experience. */
export async function GET() {
  const families = await db.family.findMany({
    include: {
      members: { select: { player: { select: { xp: true } } } },
      districts: { select: { id: true } },
    },
  });

  const rows = families
    .map((family) => ({
      name: family.name,
      members: family.members.length,
      districts: family.districts.length,
      treasury: family.treasury,
      totalXp: family.members.reduce((sum, member) => sum + member.player.xp, 0n),
    }))
    .sort((a, b) => (a.totalXp < b.totalXp ? 1 : -1))
    .slice(0, 25)
    .map((row, index) => ({ position: index + 1, ...row }));

  return json(rows);
}
