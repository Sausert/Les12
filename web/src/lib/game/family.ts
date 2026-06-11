export const FAMILY_CREATE_COST = 1000n; // seeds the treasury
export const FAMILY_MIN_RANK = 3; // picciotto
export const DISTRICT_CLAIM_COST = 2000n;
export const TURF_WAR_COST = 1000n;
export const TURF_WAR_DURATION_SEC = 300;
export const DEFENDER_BONUS_PCT = 20;
export const DISTRICT_MOVE_COOLDOWN_SEC = 60;

export type FamilyRole = "BOSS" | "UNDERBOSS" | "SOLDIER";

export function canManage(role: string): boolean {
  return role === "BOSS" || role === "UNDERBOSS";
}

/** Protection tax on a crime payout in an owned district (rounded up, min 1). */
export function districtTax(payout: bigint, taxPct: number): { tax: bigint; net: bigint } {
  if (payout <= 0n) return { tax: 0n, net: payout };
  const tax = (payout * BigInt(taxPct) + 99n) / 100n;
  return { tax, net: payout - tax };
}

/**
 * Turf war strength: the sum of member ranks, swung ±20% by the roll.
 * The defender side also gets the home-advantage bonus.
 */
export function warStrength(memberRankIds: number[], roll: number, isDefender: boolean): number {
  const base = memberRankIds.reduce((sum, rank) => sum + rank, 0);
  const swung = base * (0.8 + 0.4 * roll);
  return isDefender ? swung * (1 + DEFENDER_BONUS_PCT / 100) : swung;
}

export function resolveTurfWar(
  attackerRankIds: number[],
  defenderRankIds: number[],
  attackerRoll: number,
  defenderRoll: number,
): "ATTACKER" | "DEFENDER" {
  const attack = warStrength(attackerRankIds, attackerRoll, false);
  const defense = warStrength(defenderRankIds, defenderRoll, true);
  return attack > defense ? "ATTACKER" : "DEFENDER";
}

// --- Betrayal ---

export const BETRAYAL_EXPOSE_PCT = 35;
export const BETRAYAL_RAID_PCT = 20; // share of the treasury the police raid takes
export const BETRAYAL_COOLDOWN_SEC = 3600;
export const RAT_HEAT = 80;

export interface BetrayalOutcome {
  /** What the raid takes from the family treasury. */
  raid: bigint;
  /** The informant's cut (half the raid), paid as clean cash. */
  reward: bigint;
}

export function betrayalOutcome(treasury: bigint): BetrayalOutcome {
  const raid = (treasury * BigInt(BETRAYAL_RAID_PCT)) / 100n;
  return { raid, reward: raid / 2n };
}
