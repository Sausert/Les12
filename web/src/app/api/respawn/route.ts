import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, rateLimit } from "@/lib/api";
import { rankForXp } from "@/lib/game/ranks";
import { witnessProtectionOutcome } from "@/lib/game/pvp";
import { chainEnabled } from "@/lib/chain/client";
import { onChainBalance } from "@/lib/chain/token";
import { executeTestamentOnChain } from "@/lib/chain/testament";

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fresh") }),
  z.object({
    mode: z.literal("witness"),
    newUsername: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/),
  }),
  z.object({
    mode: z.literal("legacy"),
    heirUsername: z.string().min(1).max(30),
  }),
]);

export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  if (!player.isDead) return apiError(400, "not_dead");
  if (player.retiredAt) return apiError(400, "retired");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const body = parsed.data;

  const revivedBase = {
    isDead: false,
    diedAt: null,
    heat: 0,
    bullets: 0,
  };

  if (body.mode === "fresh") {
    // Back to the bottom: name and remaining cash survive, the reputation doesn't.
    await db.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: player.id },
        data: { ...revivedBase, xp: 0n, rankId: 1 },
      });
      await tx.protection.deleteMany({ where: { playerId: player.id } });
      await tx.search.deleteMany({ where: { targetId: player.id } });
    });
    return json({ mode: "fresh", username: player.username, xp: 0 });
  }

  if (body.mode === "legacy") {
    // Rust in vrede: the on-chain will executes (60% to the heir, 40% burned),
    // game items and remaining cash pass on, and the account retires for good.
    const heir = await db.player.findUnique({ where: { username: body.heirUsername } });
    if (!heir || heir.isDead || heir.retiredAt) return apiError(404, "heir_not_found");
    if (heir.id === player.id) return apiError(400, "cannot_target_self");

    let testamentTxHash: string | null = null;
    if (chainEnabled && player.walletAddress && heir.walletAddress) {
      try {
        const balance = await onChainBalance(player.walletAddress as Address);
        if (balance > 0n) {
          testamentTxHash = await executeTestamentOnChain(
            player.id,
            player.walletAddress as Address,
            heir.walletAddress as Address,
          );
        }
      } catch (err) {
        console.error("testament execution failed", err);
        return apiError(502, "chain_error");
      }
    }

    const inheritedCash = player.cash + player.dirtyCash;
    const itemsTransferred = await db.$transaction(async (tx) => {
      const items = await tx.item.updateMany({
        where: { ownerId: player.id, escrowed: false },
        data: { ownerId: heir.id },
      });
      await tx.player.update({
        where: { id: heir.id },
        data: { cash: { increment: player.cash }, dirtyCash: { increment: player.dirtyCash } },
      });
      await tx.player.update({
        where: { id: player.id },
        data: { cash: 0n, dirtyCash: 0n, retiredAt: new Date() },
      });
      await tx.bountyOrder.updateMany({
        where: { targetId: player.id, status: "OPEN" },
        data: { status: "CLAIMED", claimedById: null },
      });
      return items.count;
    });

    return json({
      mode: "legacy",
      heir: heir.username,
      inheritedCash,
      itemsTransferred,
      testamentTxHash,
    });
  }

  // Witness protection: a new identity, most of the experience, for a price.
  const outcome = witnessProtectionOutcome(player.xp);
  const taken = await db.player.findUnique({ where: { username: body.newUsername } });
  if (taken) return apiError(409, "username_taken");

  try {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.player.updateMany({
        where: { id: player.id, cash: { gte: outcome.cost } },
        data: { cash: { decrement: outcome.cost } },
      });
      if (debited.count === 0) return null;

      const ranks = await tx.rank.findMany({ orderBy: { id: "asc" } });
      const newRank = rankForXp(ranks, outcome.xpKept);
      await tx.player.update({
        where: { id: player.id },
        data: {
          ...revivedBase,
          username: body.newUsername,
          xp: outcome.xpKept,
          rankId: newRank.id,
        },
      });
      await tx.protection.deleteMany({ where: { playerId: player.id } });
      await tx.search.deleteMany({ where: { targetId: player.id } });
      // Open bounties die with the old identity: nobody knows the new face.
      await tx.bountyOrder.updateMany({
        where: { targetId: player.id, status: "OPEN" },
        data: { status: "CLAIMED", claimedById: null },
      });
      await tx.identityChange.create({
        data: {
          playerId: player.id,
          oldUsername: player.username,
          newUsername: body.newUsername,
          xpKept: outcome.xpKept,
          cost: outcome.cost,
        },
      });
      return { newRankKey: newRank.key };
    });
    if (!result) return apiError(400, "insufficient_cash");

    return json({
      mode: "witness",
      username: body.newUsername,
      xp: outcome.xpKept,
      cost: outcome.cost,
      rankKey: result.newRankKey,
    });
  } catch {
    return apiError(409, "username_taken");
  }
}
