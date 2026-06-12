import { describe, expect, it } from "vitest";
import {
  buyCost,
  carryCap,
  poolAfterBuy,
  poolAfterSell,
  sellGain,
  spotPrice,
} from "../market";

describe("smuggling market (bonding curve)", () => {
  const G = 1000n; // goods reserve
  const C = 10_000n; // cash reserve → spot 10

  it("derives the spot price from the reserves", () => {
    expect(spotPrice(G, C)).toBe(10n);
    expect(spotPrice(500n, 10_000n)).toBe(20n); // scarcer goods → pricier
  });

  it("charges slippage and fee on buys", () => {
    const cost = buyCost(G, C, 10n);
    // base ≈ 10000*10/990 ≈ 102 → +2% fee ≈ 104
    expect(cost).toBeGreaterThan(100n);
    expect(cost).toBeLessThan(110n);
  });

  it("makes a buy-then-sell roundtrip strictly lossy (no free money)", () => {
    const cost = buyCost(G, C, 10n);
    const after = poolAfterBuy(G, C, 10n);
    const gain = sellGain(after.goodsReserve, after.cashReserve, 10n);
    expect(gain).toBeLessThan(cost);
  });

  it("moves the price with trades: buying pumps, selling dumps", () => {
    const afterBuy = poolAfterBuy(G, C, 100n);
    expect(spotPrice(afterBuy.goodsReserve, afterBuy.cashReserve)).toBeGreaterThan(10n);
    const afterSell = poolAfterSell(G, C, 100n);
    expect(spotPrice(afterSell.goodsReserve, afterSell.cashReserve)).toBeLessThan(10n);
  });

  it("creates arbitrage between unevenly stocked districts", () => {
    // Docks flooded with whiskey vs scarce uptown: buy low, sell high.
    const cheapCost = buyCost(2000n, 10_000n, 10n);
    const richGain = sellGain(500n, 10_000n, 10n);
    expect(richGain).toBeGreaterThan(cheapCost);
  });

  it("rejects draining the pool", () => {
    expect(() => buyCost(G, C, G)).toThrow();
    expect(() => buyCost(G, C, 0n)).toThrow();
  });

  it("scales carrying capacity with rank", () => {
    expect(carryCap(1)).toBe(15);
    expect(carryCap(16)).toBe(90);
  });
});
