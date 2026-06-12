import { describe, expect, it } from "vitest";
import {
  betrayalOutcome,
  districtTax,
  resolveTurfWar,
  warStrength,
} from "../family";
import { heistSuccessChance, heistType, resolveHeist, HEIST_TYPES } from "../heists";

describe("district tax", () => {
  it("rounds the protection tax up with a minimum of 1 on any payout", () => {
    expect(districtTax(100n, 5)).toEqual({ tax: 5n, net: 95n });
    expect(districtTax(10n, 5)).toEqual({ tax: 1n, net: 9n });
    expect(districtTax(1n, 5)).toEqual({ tax: 1n, net: 0n });
    expect(districtTax(0n, 5)).toEqual({ tax: 0n, net: 0n });
  });
});

describe("turf wars", () => {
  it("gives the defender a 20% home advantage", () => {
    expect(warStrength([5, 5], 0.5, false)).toBeCloseTo(10);
    expect(warStrength([5, 5], 0.5, true)).toBeCloseTo(12);
  });

  it("lets a clearly stronger attacker win and ties go to the defender", () => {
    expect(resolveTurfWar([10, 10, 10], [1], 0.5, 0.5)).toBe("ATTACKER");
    expect(resolveTurfWar([5], [5], 0.5, 0.5)).toBe("DEFENDER"); // bonus + ties defend
  });

  it("lets rolls swing close fights", () => {
    // Equal crews: max attacker roll vs min defender roll overcomes the bonus.
    expect(resolveTurfWar([5, 5], [5, 5], 1, 0)).toBe("ATTACKER");
    expect(resolveTurfWar([5, 5], [5, 5], 0, 1)).toBe("DEFENDER");
  });
});

describe("betrayal", () => {
  it("raids 20% of the treasury and pays the rat half", () => {
    const outcome = betrayalOutcome(1000n);
    expect(outcome.raid).toBe(200n);
    expect(outcome.reward).toBe(100n);
  });
});

describe("heists", () => {
  it("caps the crew bonus at +30", () => {
    const type = heistType("train_robbery")!;
    expect(heistSuccessChance(type, [1, 1, 1])).toBe(58);
    expect(heistSuccessChance(type, [16, 16, 16])).toBe(85);
  });

  it("pays every crew member within range on success", () => {
    const type = heistType("casino_vault")!;
    const best = resolveHeist(type, [5, 5, 5], 0, 0.999999);
    expect(best.success).toBe(true);
    expect(best.payoutEach).toBe(1200n);
    const worst = resolveHeist(type, [5, 5, 5], 0, 0);
    expect(worst.payoutEach).toBe(500n);
  });

  it("gives reduced xp and full heat on failure", () => {
    const type = heistType("armored_truck")!;
    const failed = resolveHeist(type, [1, 1, 1], 99, 0.5);
    expect(failed.success).toBe(false);
    expect(failed.payoutEach).toBe(0n);
    expect(failed.xpEach).toBe(90);
    expect(failed.heatEach).toBe(15);
  });

  it("defines all heist types with three roles implied", () => {
    expect(HEIST_TYPES.map((t) => t.key)).toEqual([
      "train_robbery",
      "casino_vault",
      "armored_truck",
    ]);
  });
});
