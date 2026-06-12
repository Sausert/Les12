import { describe, expect, it } from "vitest";
import {
  accruedYield,
  bestEffect,
  effectiveBulletsNeeded,
  effectiveTravelCooldown,
  yieldClaimCutoff,
} from "../items";

describe("property yield", () => {
  const start = new Date("2026-01-01T00:00:00Z");

  it("accrues per whole day and ignores partial days", () => {
    expect(accruedYield(start, new Date("2026-01-01T23:59:00Z"), 25)).toBe(0n);
    expect(accruedYield(start, new Date("2026-01-02T00:00:00Z"), 25)).toBe(25n);
    expect(accruedYield(start, new Date("2026-01-04T12:00:00Z"), 60)).toBe(180n);
    expect(accruedYield(start, start, 25)).toBe(0n);
  });

  it("moves the claim cutoff by whole days so remainders keep accruing", () => {
    const cutoff = yieldClaimCutoff(start, new Date("2026-01-04T12:00:00Z"));
    expect(cutoff.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});

describe("item effects", () => {
  it("weapons reduce bullets needed with a floor of 1", () => {
    expect(effectiveBulletsNeeded(10, 0)).toBe(10);
    expect(effectiveBulletsNeeded(10, 20)).toBe(8);
    expect(effectiveBulletsNeeded(10, 10)).toBe(9);
    expect(effectiveBulletsNeeded(1, 90)).toBe(1);
  });

  it("cars reduce travel cooldown with a floor of 5s", () => {
    expect(effectiveTravelCooldown(60, 25)).toBe(45);
    expect(effectiveTravelCooldown(60, 50)).toBe(30);
    expect(effectiveTravelCooldown(8, 90)).toBe(5);
  });

  it("only the best item per category counts", () => {
    expect(bestEffect([])).toBe(0);
    expect(bestEffect([10, 20])).toBe(20);
  });
});
