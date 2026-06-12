export const GOODS_KEYS = ["whiskey", "cigars", "morphine"] as const;
export type GoodsKey = (typeof GOODS_KEYS)[number];

/** 2% market fee on every trade — burned, a deflationary sink. */
export const MARKET_FEE_PCT = 2n;

/** Carrying capacity per good scales with rank. */
export function carryCap(rankId: number): number {
  return 10 + rankId * 5;
}

/**
 * Constant-product bonding curve per (district, good): goodsReserve ×
 * cashReserve stays invariant, so heavy buying in one district drives its
 * price up while another district stays cheap — smuggling routes emerge from
 * player behaviour alone.
 */

/** Spot price of one unit (before slippage/fee), for display. */
export function spotPrice(goodsReserve: bigint, cashReserve: bigint): bigint {
  if (goodsReserve <= 0n) return 0n;
  return cashReserve / goodsReserve;
}

/** Dirty cash needed to buy `qty` units (slippage + fee, rounded up). */
export function buyCost(goodsReserve: bigint, cashReserve: bigint, qty: bigint): bigint {
  if (qty <= 0n || qty >= goodsReserve) throw new Error("invalid qty");
  const base = (cashReserve * qty + (goodsReserve - qty) - 1n) / (goodsReserve - qty);
  return (base * (100n + MARKET_FEE_PCT) + 99n) / 100n;
}

/** Dirty cash received for selling `qty` units (slippage + fee, rounded down). */
export function sellGain(goodsReserve: bigint, cashReserve: bigint, qty: bigint): bigint {
  if (qty <= 0n) throw new Error("invalid qty");
  const base = (cashReserve * qty) / (goodsReserve + qty);
  return (base * (100n - MARKET_FEE_PCT)) / 100n;
}

export interface PoolAfterTrade {
  goodsReserve: bigint;
  cashReserve: bigint;
}

/** Pool state after a buy: goods leave the pool, the pre-fee cash enters it. */
export function poolAfterBuy(
  goodsReserve: bigint,
  cashReserve: bigint,
  qty: bigint,
): PoolAfterTrade {
  const base = (cashReserve * qty + (goodsReserve - qty) - 1n) / (goodsReserve - qty);
  return { goodsReserve: goodsReserve - qty, cashReserve: cashReserve + base };
}

/** Pool state after a sell: goods enter the pool, the pre-fee cash leaves it. */
export function poolAfterSell(
  goodsReserve: bigint,
  cashReserve: bigint,
  qty: bigint,
): PoolAfterTrade {
  const base = (cashReserve * qty) / (goodsReserve + qty);
  return { goodsReserve: goodsReserve + qty, cashReserve: cashReserve - base };
}
