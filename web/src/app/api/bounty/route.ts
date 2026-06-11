import { db } from "@/lib/db";
import { json } from "@/lib/api";

/** Most wanted: open bounty pots per living target, biggest first. */
export async function GET() {
  const open = await db.bountyOrder.groupBy({
    by: ["targetId"],
    where: { status: "OPEN", target: { isDead: false } },
    _sum: { amount: true },
    _count: true,
  });

  const targets = await db.player.findMany({
    where: { id: { in: open.map((row) => row.targetId) } },
    select: { id: true, username: true, rank: { select: { key: true } } },
  });
  const byId = new Map(targets.map((t) => [t.id, t]));

  const list = open
    .map((row) => ({
      username: byId.get(row.targetId)?.username ?? "?",
      rankKey: byId.get(row.targetId)?.rank.key ?? "empty_suit",
      total: row._sum.amount ?? 0n,
      contracts: row._count,
    }))
    .sort((a, b) => (a.total < b.total ? 1 : -1))
    .slice(0, 25);

  return json(list);
}
