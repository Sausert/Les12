export const HEIST_ROLES = ["DRIVER", "SAFECRACKER", "LOOKOUT"] as const;
export type HeistRoleKey = (typeof HEIST_ROLES)[number];

export const HEIST_COOLDOWN_SEC = 600;

export interface HeistType {
  key: string;
  minRankId: number;
  baseSuccess: number; // percentage before crew bonus
  minPayoutEach: number;
  maxPayoutEach: number;
  xpEach: number;
  heatEach: number;
}

// Keys map to i18n messages: heists.<key>
export const HEIST_TYPES: HeistType[] = [
  {
    key: "train_robbery",
    minRankId: 1,
    baseSuccess: 55,
    minPayoutEach: 150,
    maxPayoutEach: 400,
    xpEach: 60,
    heatEach: 6,
  },
  {
    key: "casino_vault",
    minRankId: 5,
    baseSuccess: 45,
    minPayoutEach: 500,
    maxPayoutEach: 1200,
    xpEach: 180,
    heatEach: 10,
  },
  {
    key: "armored_truck",
    minRankId: 9,
    baseSuccess: 40,
    minPayoutEach: 1500,
    maxPayoutEach: 3500,
    xpEach: 450,
    heatEach: 15,
  },
];

export function heistType(key: string): HeistType | undefined {
  return HEIST_TYPES.find((type) => type.key === key);
}

/** Crew quality bonus: +1% success per total crew rank, capped at +30. */
export function heistSuccessChance(type: Pick<HeistType, "baseSuccess">, crewRankIds: number[]): number {
  const bonus = Math.min(30, crewRankIds.reduce((sum, rank) => sum + rank, 0));
  return Math.min(95, type.baseSuccess + bonus);
}

export interface HeistOutcome {
  success: boolean;
  /** Dirty cash for every crew member (0 on failure). */
  payoutEach: bigint;
  xpEach: number;
  heatEach: number;
}

export function resolveHeist(
  type: HeistType,
  crewRankIds: number[],
  roll: number,
  payoutRoll: number,
): HeistOutcome {
  const success = roll < heistSuccessChance(type, crewRankIds);
  if (!success) {
    return { success: false, payoutEach: 0n, xpEach: Math.floor(type.xpEach / 5), heatEach: type.heatEach };
  }
  const span = type.maxPayoutEach - type.minPayoutEach;
  const payoutEach = BigInt(type.minPayoutEach + Math.floor(payoutRoll * (span + 1)));
  return { success: true, payoutEach, xpEach: type.xpEach, heatEach: type.heatEach };
}
