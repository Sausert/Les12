export const BULLET_PRICE = 30n; // clean OMD per bullet
export const PROTECTION_PRICE = 200n;
export const PROTECTION_HOURS = 24;
export const SEARCH_COOLDOWN_SEC = 120;
export const SEARCH_VALID_SEC = 600;
export const KILL_HEAT_GAIN = 25;
export const WITNESS_PROTECTION_COST = 500n;
export const WITNESS_XP_KEPT_PCT = 75;
export const FRESH_START_XP_KEPT_PCT = 0;
export const BLOOD_MONEY_PCT = 60; // share of the victim's cash the killer takes

/** Bullets needed to take a victim down, before the resolution roll. */
export function bulletsNeeded(victimRankId: number, isProtected: boolean): number {
  const base = 5 + victimRankId * 5;
  return isProtected ? base * 2 : base;
}

export interface KillOutcome {
  success: boolean;
  /** Bullets spent (always all bullets fired). */
  bulletsSpent: number;
}

/**
 * A kill lands when the bullets fired cover the (roll-adjusted) requirement.
 * `roll` in [0,1) shifts the requirement between 85% and 115%.
 */
export function resolveKill(bulletsFired: number, needed: number, roll: number): KillOutcome {
  const adjusted = Math.ceil(needed * (0.85 + 0.3 * roll));
  return { success: bulletsFired >= adjusted, bulletsSpent: bulletsFired };
}

/** Worst-case bullets that always satisfy the roll (UI hint + e2e determinism). */
export function bulletsForGuaranteedKill(needed: number): number {
  return Math.ceil(needed * 1.15);
}

export interface BloodMoney {
  /** Dirty cash the killer pockets (stolen money is never clean). */
  toKiller: bigint;
  /** What the victim's estate keeps (40%) — split per balance type. */
  victimKeepsCash: bigint;
  victimKeepsDirty: bigint;
}

export function bloodMoney(victimCash: bigint, victimDirtyCash: bigint): BloodMoney {
  const keepPct = BigInt(100 - BLOOD_MONEY_PCT);
  const victimKeepsCash = (victimCash * keepPct) / 100n;
  const victimKeepsDirty = (victimDirtyCash * keepPct) / 100n;
  const toKiller = victimCash + victimDirtyCash - victimKeepsCash - victimKeepsDirty;
  return { toKiller, victimKeepsCash, victimKeepsDirty };
}

/** XP for a confirmed kill scales with the victim's rank. */
export function killXp(victimRankId: number): number {
  return victimRankId * 50;
}

// --- Jail ---

export const BREAKOUT_SUCCESS_PCT = 40;
export const BREAKOUT_FAIL_JAIL_SEC = 120;

/** Chance (0-100) that a failed crime lands you in jail, driven by heat. */
export function jailChance(heat: number): number {
  return Math.min(50, Math.floor(heat / 2));
}

/** Jail time scales with the severity (heatGain) of the failed crime. */
export function jailDurationSec(crimeHeatGain: number): number {
  return 60 + crimeHeatGain * 20;
}

/** Buying your way out: 25 OMD per started minute remaining. */
export function bribeCost(remainingSec: number): bigint {
  return BigInt(Math.max(1, Math.ceil(remainingSec / 60))) * 25n;
}

// --- Respawn ---

export interface RespawnOutcome {
  xpKept: bigint;
  cost: bigint;
}

export function witnessProtectionOutcome(xp: bigint): RespawnOutcome {
  return { xpKept: (xp * BigInt(WITNESS_XP_KEPT_PCT)) / 100n, cost: WITNESS_PROTECTION_COST };
}

export function freshStartOutcome(): RespawnOutcome {
  return { xpKept: 0n, cost: 0n };
}
