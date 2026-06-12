export interface RankDef {
  id: number;
  key: string;
  minXp: bigint;
}

/** Highest rank whose minXp the player has reached. Ranks must be sorted by id. */
export function rankForXp(ranks: RankDef[], xp: bigint): RankDef {
  let current = ranks[0];
  for (const rank of ranks) {
    if (xp >= rank.minXp) current = rank;
    else break;
  }
  return current;
}

/** Progress towards the next rank as 0-100; 100 when at max rank. */
export function rankProgress(ranks: RankDef[], xp: bigint): number {
  const current = rankForXp(ranks, xp);
  const next = ranks.find((r) => r.id === current.id + 1);
  if (!next) return 100;
  const span = next.minXp - current.minXp;
  const into = xp - current.minXp;
  return Math.min(100, Math.max(0, Number((into * 100n) / span)));
}
