import { MAX_HEAT } from "./crimes";

/** Fee (percent) charged when laundering dirty cash into clean cash. */
export const LAUNDER_FEE_PCT = 15;

export interface LaunderOutcome {
  /** Clean cash credited after the fee. */
  cleanGained: bigint;
  /** Fee burned (the deflationary sink). */
  fee: bigint;
  /** Heat reduction earned by cleaning money. */
  heatReduction: number;
}

export function resolveLaunder(amount: bigint, currentHeat: number): LaunderOutcome {
  const fee = (amount * BigInt(LAUNDER_FEE_PCT) + 99n) / 100n; // round fee up
  const cleanGained = amount - fee;
  // Laundering 100 OMD clears ~5 heat, capped at current heat.
  const heatReduction = Math.min(currentHeat, Math.max(1, Number(amount / 20n)));
  return { cleanGained, fee, heatReduction: Math.min(heatReduction, MAX_HEAT) };
}
