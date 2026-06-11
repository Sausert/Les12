import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashServerSeed } from "@/lib/game/rng";
import { CASINO_MIN_BET, CASINO_MAX_BET } from "@/lib/game/casino";

export function validBet(bet: bigint): boolean {
  return bet >= CASINO_MIN_BET && bet <= CASINO_MAX_BET;
}

/** Creates a committed round: the hash is public before any bet is placed. */
export async function createCommittedRound(playerId: string) {
  const serverSeed = randomBytes(32).toString("hex");
  const round = await db.casinoRound.create({
    data: {
      playerId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
    },
    select: { id: true, serverSeedHash: true },
  });
  return round;
}

type Tx = Prisma.TransactionClient;

/**
 * Atomically moves a round from one status to the next for this player.
 * Returns false when the round was already consumed (double-submit guard).
 */
export async function claimRound(
  tx: Tx,
  roundId: string,
  playerId: string,
  from: string,
  to: string,
  data: Prisma.CasinoRoundUpdateManyMutationInput = {},
): Promise<boolean> {
  const claimed = await tx.casinoRound.updateMany({
    where: { id: roundId, playerId, status: from },
    data: { ...data, status: to },
  });
  return claimed.count === 1;
}

/** Guarded clean-cash debit; returns false when the balance is short. */
export async function debitCash(tx: Tx, playerId: string, amount: bigint): Promise<boolean> {
  const debited = await tx.player.updateMany({
    where: { id: playerId, cash: { gte: amount } },
    data: { cash: { decrement: amount } },
  });
  return debited.count === 1;
}
