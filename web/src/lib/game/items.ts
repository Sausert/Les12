export const AUCTION_MIN_DURATION_MIN = 1;
export const AUCTION_MAX_DURATION_MIN = 60 * 24; // a day

/** Whole days of rent accrued since the last claim (partial days wait). */
export function accruedYield(lastYieldAt: Date, now: Date, yieldPerDay: number): bigint {
  const elapsedMs = now.getTime() - lastYieldAt.getTime();
  if (elapsedMs <= 0 || yieldPerDay <= 0) return 0n;
  const days = Math.floor(elapsedMs / 86_400_000);
  return BigInt(days) * BigInt(yieldPerDay);
}

/** The claim consumes whole days only; the remainder keeps accruing. */
export function yieldClaimCutoff(lastYieldAt: Date, now: Date): Date {
  const days = Math.floor((now.getTime() - lastYieldAt.getTime()) / 86_400_000);
  return new Date(lastYieldAt.getTime() + days * 86_400_000);
}

/** A weapon shaves a percentage off the bullets needed for a kill. */
export function effectiveBulletsNeeded(base: number, weaponPct: number): number {
  return Math.max(1, Math.ceil((base * (100 - weaponPct)) / 100));
}

/** A car shaves a percentage off the district travel cooldown. */
export function effectiveTravelCooldown(baseSec: number, carPct: number): number {
  return Math.max(5, Math.ceil((baseSec * (100 - carPct)) / 100));
}

/** Only the best item of each category counts. */
export function bestEffect(effects: number[]): number {
  return effects.length === 0 ? 0 : Math.max(...effects);
}
