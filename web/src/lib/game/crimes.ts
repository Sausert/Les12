export interface CrimeDef {
  id: number;
  key: string;
  minRankId: number;
  cooldownSec: number;
  baseSuccess: number;
  minPayout: number;
  maxPayout: number;
  xpReward: number;
  heatGain: number;
}

export interface CrimeOutcome {
  success: boolean;
  /** Dirty cash earned (0 on failure). */
  payout: bigint;
  /** XP gained — failures still teach a little. */
  xpGained: number;
  heatGained: number;
}

export const MAX_HEAT = 100;

/** Heat pushes success odds down: at 100 heat a crime is 30 points harder. */
export function successChance(crime: Pick<CrimeDef, "baseSuccess">, heat: number): number {
  const penalty = Math.floor((Math.min(Math.max(heat, 0), MAX_HEAT) * 30) / MAX_HEAT);
  return Math.min(95, Math.max(5, crime.baseSuccess - penalty));
}

/**
 * Resolves a crime attempt. Pure: all randomness comes in via `roll` (0-99)
 * and `payoutRoll` (0-1), so the function is fully unit-testable.
 */
export function resolveCrime(
  crime: CrimeDef,
  heat: number,
  roll: number,
  payoutRoll: number,
): CrimeOutcome {
  const success = roll < successChance(crime, heat);
  if (!success) {
    return {
      success: false,
      payout: 0n,
      xpGained: Math.max(1, Math.floor(crime.xpReward / 5)),
      heatGained: crime.heatGain,
    };
  }
  const span = crime.maxPayout - crime.minPayout;
  const payout = BigInt(crime.minPayout + Math.floor(payoutRoll * (span + 1)));
  return { success: true, payout, xpGained: crime.xpReward, heatGained: crime.heatGain };
}

export function applyHeat(current: number, gained: number): number {
  return Math.min(MAX_HEAT, Math.max(0, current + gained));
}
