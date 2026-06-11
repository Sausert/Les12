import { db } from "@/lib/db";
import { json } from "@/lib/api";

/** Players currently behind bars (public — everyone reads the paper). */
export async function GET() {
  const inmates = await db.player.findMany({
    where: { jailedUntil: { gt: new Date() }, isDead: false },
    orderBy: { jailedUntil: "asc" },
    take: 25,
    select: {
      username: true,
      jailedUntil: true,
      rank: { select: { key: true } },
    },
  });

  return json(
    inmates.map((inmate) => ({
      username: inmate.username,
      rankKey: inmate.rank.key,
      jailedUntil: inmate.jailedUntil!.toISOString(),
    })),
  );
}
