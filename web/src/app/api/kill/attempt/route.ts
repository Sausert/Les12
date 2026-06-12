import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, requireFree, rateLimit } from "@/lib/api";
import { applyHeat } from "@/lib/game/crimes";
import { rankForXp } from "@/lib/game/ranks";
import { bloodMoney, bulletsNeeded, killXp, resolveKill, KILL_HEAT_GAIN } from "@/lib/game/pvp";
import { effectiveBulletsNeeded } from "@/lib/game/items";
import { getBestEffects } from "@/lib/server/items";
import { chainEnabled } from "@/lib/chain/client";
import { claimBountyOnChain } from "@/lib/chain/bounty";

const bodySchema = z.object({
  username: z.string().min(1).max(30),
  bullets: z.number().int().positive().max(10_000),
});

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player) ?? requireFree(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const { username, bullets: bulletsFired } = parsed.data;

  const target = await db.player.findUnique({
    where: { username },
    include: { protection: true },
  });
  if (!target || target.isDead) return apiError(404, "target_not_found");
  if (target.id === player.id) return apiError(400, "cannot_target_self");
  const now = new Date();
  if (target.jailedUntil && target.jailedUntil > now)
    return apiError(400, "target_in_custody");

  const search = await db.search.findUnique({
    where: { seekerId_targetId: { seekerId: player.id, targetId: target.id } },
  });
  if (!search || search.expiresAt <= now) return apiError(400, "target_not_located");

  if (player.bullets < bulletsFired) return apiError(400, "insufficient_bullets");

  const isProtected = Boolean(target.protection && target.protection.expiresAt > now);
  // A good weapon brings the requirement down.
  const { weaponPct } = await getBestEffects(player.id);
  const needed = effectiveBulletsNeeded(bulletsNeeded(target.rankId, isProtected), weaponPct);
  const roll = randomInt(0, 1_000_000) / 1_000_000;
  const outcome = resolveKill(bulletsFired, needed, roll);

  const result = await db.$transaction(async (tx) => {
    // Spend bullets (guarded against concurrent attempts) and consume the search.
    const spent = await tx.player.updateMany({
      where: { id: player.id, bullets: { gte: bulletsFired } },
      data: { bullets: { decrement: bulletsFired }, heat: applyHeat(player.heat, KILL_HEAT_GAIN) },
    });
    if (spent.count === 0) return null;
    await tx.search.delete({
      where: { seekerId_targetId: { seekerId: player.id, targetId: target.id } },
    });

    if (!outcome.success) {
      await tx.killAttempt.create({
        data: {
          attackerId: player.id,
          victimId: target.id,
          bulletsUsed: bulletsFired,
          success: false,
        },
      });
      return { success: false as const, bloodMoney: 0n, bountyTotal: 0n, rankUp: null };
    }

    // Re-read the victim inside the transaction; a parallel kill may have landed first.
    const victim = await tx.player.findUniqueOrThrow({ where: { id: target.id } });
    if (victim.isDead) return null;

    const split = bloodMoney(victim.cash, victim.dirtyCash);
    const xpGained = killXp(victim.rankId);
    const ranks = await tx.rank.findMany({ orderBy: { id: "asc" } });
    const newXp = player.xp + BigInt(xpGained);
    const newRank = rankForXp(ranks, newXp);

    await tx.player.update({
      where: { id: target.id },
      data: {
        isDead: true,
        diedAt: now,
        cash: split.victimKeepsCash,
        dirtyCash: split.victimKeepsDirty,
      },
    });
    await tx.player.update({
      where: { id: player.id },
      data: { dirtyCash: { increment: split.toKiller }, xp: newXp, rankId: newRank.id },
    });

    // Sweep all open bounties on the victim's head.
    const openBounties = await tx.bountyOrder.findMany({
      where: { targetId: target.id, status: "OPEN" },
    });
    const bountyTotal = openBounties.reduce((sum, order) => sum + order.amount, 0n);
    if (openBounties.length > 0) {
      await tx.bountyOrder.updateMany({
        where: { targetId: target.id, status: "OPEN" },
        data: { status: "CLAIMED", claimedById: player.id },
      });
      if (!chainEnabled && bountyTotal > 0n) {
        // Off-chain fallback: pay the pot as clean cash.
        await tx.player.update({
          where: { id: player.id },
          data: { cash: { increment: bountyTotal } },
        });
      }
    }

    const attempt = await tx.killAttempt.create({
      data: {
        attackerId: player.id,
        victimId: target.id,
        bulletsUsed: bulletsFired,
        success: true,
        bloodMoney: split.toKiller,
        bountyPaid: bountyTotal,
      },
    });

    return {
      success: true as const,
      bloodMoney: split.toKiller,
      bountyTotal,
      xpGained,
      rankUp: newRank.id > player.rankId ? { id: newRank.id, key: newRank.key } : null,
      attemptId: attempt.id,
    };
  });

  if (!result) return apiError(409, "conflict");

  // On-chain bounty payout happens after the game state is committed.
  let bountyTxHash: string | null = null;
  if (result.success && result.bountyTotal > 0n && chainEnabled && target.walletAddress && player.walletAddress) {
    try {
      bountyTxHash = await claimBountyOnChain(
        target.walletAddress as Address,
        player.walletAddress as Address,
      );
      await db.bountyOrder.updateMany({
        where: { targetId: target.id, claimedById: player.id, status: "CLAIMED", claimTxHash: null },
        data: { claimTxHash: bountyTxHash },
      });
    } catch (err) {
      console.error("bounty claim failed", err);
    }
  }

  return json({
    success: result.success,
    bulletsUsed: bulletsFired,
    bloodMoney: result.bloodMoney,
    bountyPaid: result.bountyTotal,
    bountyTxHash,
    xpGained: result.success ? result.xpGained : 0,
    rankUp: result.success ? result.rankUp : null,
  });
}
