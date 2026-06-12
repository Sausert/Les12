import { db } from "@/lib/db";
import { json } from "@/lib/api";

/** Public newspaper feed: confirmed kills and jailings, newest first. */
export async function GET() {
  const [kills, jailings] = await Promise.all([
    db.killAttempt.findMany({
      where: { success: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        bloodMoney: true,
        bountyPaid: true,
        createdAt: true,
        attacker: { select: { username: true } },
        victim: { select: { username: true } },
      },
    }),
    db.jailEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        reason: true,
        until: true,
        createdAt: true,
        player: { select: { username: true } },
      },
    }),
  ]);

  const items = [
    ...kills.map((kill) => ({
      id: `kill_${kill.id}`,
      type: "KILL" as const,
      attacker: kill.attacker.username,
      victim: kill.victim.username,
      bloodMoney: kill.bloodMoney,
      bountyPaid: kill.bountyPaid,
      at: kill.createdAt.toISOString(),
    })),
    ...jailings.map((event) => ({
      id: `jail_${event.id}`,
      type: "JAIL" as const,
      player: event.player.username,
      reason: event.reason,
      until: event.until.toISOString(),
      at: event.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 25);

  return json(items);
}
