import { describe, expect, it } from "vitest";
import {
  bloodMoney,
  bribeCost,
  bulletsForGuaranteedKill,
  bulletsNeeded,
  jailChance,
  jailDurationSec,
  killXp,
  resolveKill,
  witnessProtectionOutcome,
} from "../pvp";

describe("kill resolution", () => {
  it("scales bullets needed with rank and doubles under protection", () => {
    expect(bulletsNeeded(1, false)).toBe(10);
    expect(bulletsNeeded(10, false)).toBe(55);
    expect(bulletsNeeded(1, true)).toBe(20);
  });

  it("fails with too few bullets and succeeds above the worst-case roll", () => {
    const needed = bulletsNeeded(1, false); // 10
    expect(resolveKill(5, needed, 0.5).success).toBe(false);
    // Worst roll (1.0 → ×1.15): 12 bullets always land.
    const guaranteed = bulletsForGuaranteedKill(needed);
    expect(guaranteed).toBe(12);
    expect(resolveKill(guaranteed, needed, 0.999999).success).toBe(true);
    // Best roll (0 → ×0.85): 9 bullets just land.
    expect(resolveKill(9, needed, 0).success).toBe(true);
    expect(resolveKill(8, needed, 0).success).toBe(false);
  });

  it("splits blood money 60/40 and pays the killer in dirty cash", () => {
    const split = bloodMoney(100n, 50n);
    expect(split.toKiller).toBe(90n);
    expect(split.victimKeepsCash).toBe(40n);
    expect(split.victimKeepsDirty).toBe(20n);
    expect(split.toKiller + split.victimKeepsCash + split.victimKeepsDirty).toBe(150n);
  });

  it("rewards kill xp by victim rank", () => {
    expect(killXp(1)).toBe(50);
    expect(killXp(16)).toBe(800);
  });
});

describe("jail", () => {
  it("caps jail chance at 50%", () => {
    expect(jailChance(0)).toBe(0);
    expect(jailChance(60)).toBe(30);
    expect(jailChance(100)).toBe(50);
  });

  it("scales jail time with crime severity", () => {
    expect(jailDurationSec(1)).toBe(80);
    expect(jailDurationSec(20)).toBe(460);
  });

  it("prices bribes per started minute", () => {
    expect(bribeCost(30)).toBe(25n);
    expect(bribeCost(61)).toBe(50n);
    expect(bribeCost(0)).toBe(25n); // minimum one minute
  });
});

describe("witness protection", () => {
  it("keeps 75% of xp for a fee", () => {
    const outcome = witnessProtectionOutcome(1000n);
    expect(outcome.xpKept).toBe(750n);
    expect(outcome.cost).toBe(500n);
  });
});
