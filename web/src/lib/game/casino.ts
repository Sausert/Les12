import { cardRank, cardSuit } from "./cards";

export const CASINO_MIN_BET = 1n;
export const CASINO_MAX_BET = 10_000n;

// --- Dice: roll under `target` (2-98) on a 0-99 roll, ~1% house edge ---

export function diceWinChance(target: number): number {
  return target; // roll 0..99 strictly below target
}

export function dicePayout(bet: bigint, target: number): bigint {
  return (bet * 99n) / BigInt(target);
}

export interface DiceOutcome {
  roll: number;
  win: boolean;
  payout: bigint;
}

export function resolveDice(bet: bigint, target: number, roll: number): DiceOutcome {
  const win = roll < target;
  return { roll, win, payout: win ? dicePayout(bet, target) : 0n };
}

// --- Roulette: single zero (0-36) ---

export type RouletteBet =
  | { type: "number"; number: number }
  | { type: "red" }
  | { type: "black" }
  | { type: "odd" }
  | { type: "even" }
  | { type: "low" } // 1-18
  | { type: "high" }; // 19-36

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export interface RouletteOutcome {
  spin: number;
  win: boolean;
  payout: bigint;
}

export function resolveRoulette(bet: bigint, choice: RouletteBet, spin: number): RouletteOutcome {
  let win = false;
  let multiplier = 0n;
  switch (choice.type) {
    case "number":
      win = spin === choice.number;
      multiplier = 36n; // 35:1 plus stake back
      break;
    case "red":
      win = RED_NUMBERS.has(spin);
      multiplier = 2n;
      break;
    case "black":
      win = spin !== 0 && !RED_NUMBERS.has(spin);
      multiplier = 2n;
      break;
    case "odd":
      win = spin !== 0 && spin % 2 === 1;
      multiplier = 2n;
      break;
    case "even":
      win = spin !== 0 && spin % 2 === 0;
      multiplier = 2n;
      break;
    case "low":
      win = spin >= 1 && spin <= 18;
      multiplier = 2n;
      break;
    case "high":
      win = spin >= 19 && spin <= 36;
      multiplier = 2n;
      break;
  }
  return { spin, win, payout: win ? bet * multiplier : 0n };
}

// --- Blackjack: single deck, dealer stands on 17, blackjack pays 3:2 ---

export function handValue(cards: number[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const rank = cardRank(card);
    if (rank === 12) {
      aces += 1;
      total += 11;
    } else if (rank >= 8) {
      total += 10;
    } else {
      total += rank + 2;
    }
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
    soft = aces > 0;
  }
  return { total, soft };
}

export function isBlackjack(cards: number[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Dealer draws from `deck` starting at `deckPos` until reaching 17+. */
export function dealerPlay(
  dealerCards: number[],
  deck: number[],
  deckPos: number,
): { cards: number[]; deckPos: number } {
  const cards = [...dealerCards];
  let pos = deckPos;
  while (handValue(cards).total < 17) {
    cards.push(deck[pos]);
    pos += 1;
  }
  return { cards, deckPos: pos };
}

export interface BlackjackSettlement {
  result: "WIN" | "LOSE" | "PUSH" | "BLACKJACK";
  payout: bigint;
}

export function settleBlackjack(
  bet: bigint,
  playerCards: number[],
  dealerCards: number[],
): BlackjackSettlement {
  const player = handValue(playerCards).total;
  const dealer = handValue(dealerCards).total;

  if (player > 21) return { result: "LOSE", payout: 0n };
  if (isBlackjack(playerCards) && !isBlackjack(dealerCards)) {
    return { result: "BLACKJACK", payout: bet + (bet * 3n) / 2n };
  }
  if (isBlackjack(dealerCards) && !isBlackjack(playerCards)) {
    return { result: "LOSE", payout: 0n };
  }
  if (dealer > 21 || player > dealer) return { result: "WIN", payout: bet * 2n };
  if (player === dealer) return { result: "PUSH", payout: bet };
  return { result: "LOSE", payout: 0n };
}

// --- Video poker: Jacks or Better (9/6 pay table, per unit bet) ---

export type VideoPokerHand =
  | "ROYAL_FLUSH"
  | "STRAIGHT_FLUSH"
  | "FOUR_OF_A_KIND"
  | "FULL_HOUSE"
  | "FLUSH"
  | "STRAIGHT"
  | "THREE_OF_A_KIND"
  | "TWO_PAIR"
  | "JACKS_OR_BETTER"
  | "NOTHING";

export const VIDEO_POKER_PAYTABLE: Record<VideoPokerHand, bigint> = {
  ROYAL_FLUSH: 250n,
  STRAIGHT_FLUSH: 50n,
  FOUR_OF_A_KIND: 25n,
  FULL_HOUSE: 9n,
  FLUSH: 6n,
  STRAIGHT: 4n,
  THREE_OF_A_KIND: 3n,
  TWO_PAIR: 2n,
  JACKS_OR_BETTER: 1n,
  NOTHING: 0n,
};

/** Evaluates a 5-card hand. Ranks: 0='2' … 9='J', 10='Q', 11='K', 12='A'. */
export function evaluateVideoPoker(cards: number[]): VideoPokerHand {
  const ranks = cards.map(cardRank).sort((a, b) => a - b);
  const suits = cards.map(cardSuit);
  const isFlush = suits.every((suit) => suit === suits[0]);

  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);

  const uniqueRanks = [...counts.keys()].sort((a, b) => a - b);
  const isWheel = // A-2-3-4-5: ace plays low
    uniqueRanks.length === 5 &&
    uniqueRanks[0] === 0 &&
    uniqueRanks[3] === 3 &&
    uniqueRanks[4] === 12;
  const isStraight =
    uniqueRanks.length === 5 &&
    (uniqueRanks[4] - uniqueRanks[0] === 4 || isWheel);
  const isRoyal = isStraight && !isWheel && uniqueRanks[0] === 8; // T J Q K A

  if (isStraight && isFlush && isRoyal) return "ROYAL_FLUSH";
  if (isStraight && isFlush) return "STRAIGHT_FLUSH";
  if (groups[0] === 4) return "FOUR_OF_A_KIND";
  if (groups[0] === 3 && groups[1] === 2) return "FULL_HOUSE";
  if (isFlush) return "FLUSH";
  if (isStraight) return "STRAIGHT";
  if (groups[0] === 3) return "THREE_OF_A_KIND";
  if (groups[0] === 2 && groups[1] === 2) return "TWO_PAIR";
  if (groups[0] === 2) {
    const pairRank = [...counts.entries()].find(([, count]) => count === 2)![0];
    if (pairRank >= 9) return "JACKS_OR_BETTER"; // J, Q, K or A
  }
  return "NOTHING";
}

export function videoPokerPayout(bet: bigint, hand: VideoPokerHand): bigint {
  return bet * VIDEO_POKER_PAYTABLE[hand];
}
