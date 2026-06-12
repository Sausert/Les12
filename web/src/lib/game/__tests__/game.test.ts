import { describe, expect, it } from "vitest";
import { rankForXp, rankProgress, type RankDef } from "../ranks";
import { applyHeat, resolveCrime, successChance, type CrimeDef } from "../crimes";
import { resolveLaunder, LAUNDER_FEE_PCT } from "../bank";

const ranks: RankDef[] = [
  { id: 1, key: "empty_suit", minXp: 0n },
  { id: 2, key: "delivery_boy", minXp: 100n },
  { id: 3, key: "picciotto", minXp: 350n },
];

const crime: CrimeDef = {
  id: 1,
  key: "pickpocket",
  minRankId: 1,
  cooldownSec: 60,
  baseSuccess: 80,
  minPayout: 10,
  maxPayout: 40,
  xpReward: 8,
  heatGain: 3,
};

describe("ranks", () => {
  it("maps xp to the highest reached rank", () => {
    expect(rankForXp(ranks, 0n).key).toBe("empty_suit");
    expect(rankForXp(ranks, 99n).key).toBe("empty_suit");
    expect(rankForXp(ranks, 100n).key).toBe("delivery_boy");
    expect(rankForXp(ranks, 9999n).key).toBe("picciotto");
  });

  it("reports progress towards the next rank", () => {
    expect(rankProgress(ranks, 0n)).toBe(0);
    expect(rankProgress(ranks, 50n)).toBe(50);
    expect(rankProgress(ranks, 350n)).toBe(100); // max rank
  });
});

describe("crimes", () => {
  it("applies a heat penalty to the success chance", () => {
    expect(successChance(crime, 0)).toBe(80);
    expect(successChance(crime, 100)).toBe(50);
    expect(successChance({ baseSuccess: 20 }, 100)).toBe(5); // floor
    expect(successChance({ baseSuccess: 99 }, 0)).toBe(95); // ceiling
  });

  it("pays out within the configured range on success", () => {
    const low = resolveCrime(crime, 0, 0, 0);
    const high = resolveCrime(crime, 0, 0, 0.999999);
    expect(low.success).toBe(true);
    expect(low.payout).toBe(10n);
    expect(high.payout).toBe(40n);
    expect(low.xpGained).toBe(8);
  });

  it("gives reduced xp and no payout on failure", () => {
    const failed = resolveCrime(crime, 0, 99, 0.5);
    expect(failed.success).toBe(false);
    expect(failed.payout).toBe(0n);
    expect(failed.xpGained).toBeGreaterThanOrEqual(1);
    expect(failed.heatGained).toBe(crime.heatGain);
  });

  it("clamps heat between 0 and 100", () => {
    expect(applyHeat(98, 5)).toBe(100);
    expect(applyHeat(2, -5)).toBe(0);
  });
});

describe("laundering", () => {
  it("charges the fee and rounds it up", () => {
    const outcome = resolveLaunder(100n, 50);
    expect(outcome.fee).toBe(15n);
    expect(outcome.cleanGained).toBe(85n);

    const tiny = resolveLaunder(1n, 50);
    expect(tiny.fee).toBe(1n); // rounded up
    expect(tiny.cleanGained).toBe(0n);
  });

  it("never reduces more heat than the player has", () => {
    const outcome = resolveLaunder(10_000n, 7);
    expect(outcome.heatReduction).toBe(7);
  });

  it("keeps the fee percentage consistent with the constant", () => {
    const outcome = resolveLaunder(1000n, 0);
    expect(outcome.fee).toBe((1000n * BigInt(LAUNDER_FEE_PCT)) / 100n);
  });
});
