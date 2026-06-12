import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError } from "@/lib/api";
import { chainEnabled } from "@/lib/chain/client";
import { mintTrophyTo } from "@/lib/chain/trophy";

const TROPHY_POSITIONS = 3;

/**
 * Admin-only season rollover: freeze the top standings, mint soulbound
 * trophies, reset every reputation and open the next season. Guarded by the
 * ADMIN_SECRET env var rather than a player session.
 */
export async function POST(request: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || request.headers.get("x-admin-secret") !== secret) {
    return apiError(401, "unauthorized");
  }

  const season = await db.season.findFirst({ where: { status: "ACTIVE" }, orderBy: { id: "desc" } });
  if (!season) return apiError(400, "no_active_season");

  const top = await db.player.findMany({
    where: { retiredAt: null, xp: { gt: 0n } },
    orderBy: { xp: "desc" },
    take: TROPHY_POSITIONS,
  });

  // Close the books first; trophies mint afterwards (idempotent per position).
  const results = await db.$transaction(async (tx) => {
    const claimed = await tx.season.updateMany({
      where: { id: season.id, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const rows = [];
    for (const [index, player] of top.entries()) {
      rows.push(
        await tx.seasonResult.create({
          data: {
            seasonId: season.id,
            playerId: player.id,
            position: index + 1,
            xp: player.xp,
            username: player.username,
          },
        }),
      );
    }
    // The race restarts: reputations reset, fortunes and possessions stay.
    await tx.player.updateMany({
      where: { retiredAt: null },
      data: { xp: 0n, rankId: 1, heat: 0 },
    });
    await tx.season.create({ data: { id: season.id + 1 } });
    return rows;
  });
  if (!results) return apiError(409, "conflict");

  const trophies: { position: number; username: string; trophyTokenId: string | null }[] = [];
  for (const [index, player] of top.entries()) {
    let trophyTokenId: bigint | null = null;
    if (chainEnabled && player.walletAddress) {
      try {
        const minted = await mintTrophyTo(player.walletAddress as Address, season.id, index + 1);
        trophyTokenId = minted.tokenId;
        await db.seasonResult.update({
          where: { seasonId_position: { seasonId: season.id, position: index + 1 } },
          data: { trophyTokenId, trophyTxHash: minted.txHash },
        });
      } catch (err) {
        console.error("trophy mint failed", err);
      }
    }
    trophies.push({
      position: index + 1,
      username: player.username,
      trophyTokenId: trophyTokenId?.toString() ?? null,
    });
  }

  return json({ endedSeason: season.id, nextSeason: season.id + 1, trophies });
}
