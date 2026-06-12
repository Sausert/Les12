import type { SeededRng } from "./rng";

/**
 * Cards are integers 0-51: rank = card % 13 (0='2' … 8='T', 9='J', 10='Q',
 * 11='K', 12='A'), suit = floor(card / 13) (S, H, D, C).
 */

const RANKS = "23456789TJQKA";
const SUITS = "SHDC";

export function cardCode(card: number): string {
  return `${RANKS[card % 13]}${SUITS[Math.floor(card / 13)]}`;
}

export function cardRank(card: number): number {
  return card % 13;
}

export function cardSuit(card: number): number {
  return Math.floor(card / 13);
}

/** Deterministic Fisher-Yates shuffle of a single 52-card deck. */
export function shuffledDeck(rng: SeededRng): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
