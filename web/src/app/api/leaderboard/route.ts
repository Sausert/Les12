import { db } from "@/lib/db";
import { json } from "@/lib/api";

export async function GET(request: Request) {
  const by = new URL(request.url).searchParams.get("by") === "cash" ? "cash" : "xp";

  const players = await db.player.findMany({
    orderBy: { [by]: "desc" },
    take: 50,
    select: {
      username: true,
      xp: true,
      cash: true,
      rank: { select: { key: true } },
    },
  });

  return json(
    players.map((p, i) => ({
      position: i + 1,
      username: p.username,
      xp: p.xp,
      cash: p.cash,
      rankKey: p.rank.key,
    })),
  );
}
