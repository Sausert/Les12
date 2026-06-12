import { describe, expect, it } from "vitest";
import { SeededRng, hashServerSeed } from "../rng";
import { cardCode, shuffledDeck } from "../cards";
import {
  dealerPlay,
  dicePayout,
  evaluateVideoPoker,
  handValue,
  isBlackjack,
  resolveDice,
  resolveRoulette,
  settleBlackjack,
  videoPokerPayout,
} from "../casino";

/** Builds a card from code like "AS" or "TH" (mirrors cardCode). */
function card(code: string): number {
  const rank = "23456789TJQKA".indexOf(code[0]);
  const suit = "SHDC".indexOf(code[1]);
  return suit * 13 + rank;
}

describe("seeded rng", () => {
  it("is deterministic for the same seeds and differs across seeds", () => {
    const a = new SeededRng("seed", "client");
    const b = new SeededRng("seed", "client");
    const c = new SeededRng("other", "client");
    const seqA = Array.from({ length: 10 }, () => a.nextInt(100));
    const seqB = Array.from({ length: 10 }, () => b.nextInt(100));
    const seqC = Array.from({ length: 10 }, () => c.nextInt(100));
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it("hashes the server seed with sha256", () => {
    expect(hashServerSeed("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("shuffles a full deck without duplicates, deterministically", () => {
    const deck = shuffledDeck(new SeededRng("seed", "client"));
    expect(new Set(deck).size).toBe(52);
    expect(deck).toEqual(shuffledDeck(new SeededRng("seed", "client")));
  });
});

describe("dice", () => {
  it("pays 99/target and resolves strictly under the target", () => {
    expect(dicePayout(100n, 50)).toBe(198n);
    expect(resolveDice(100n, 50, 49).win).toBe(true);
    expect(resolveDice(100n, 50, 50).win).toBe(false);
  });
});

describe("roulette", () => {
  it("pays 36x on a hit number and nothing on zero for outside bets", () => {
    expect(resolveRoulette(10n, { type: "number", number: 17 }, 17).payout).toBe(360n);
    expect(resolveRoulette(10n, { type: "red" }, 0).win).toBe(false);
    expect(resolveRoulette(10n, { type: "even" }, 0).win).toBe(false);
    expect(resolveRoulette(10n, { type: "red" }, 1).payout).toBe(20n);
    expect(resolveRoulette(10n, { type: "black" }, 2).payout).toBe(20n);
    expect(resolveRoulette(10n, { type: "high" }, 19).win).toBe(true);
  });
});

describe("blackjack", () => {
  it("values hands with soft aces correctly", () => {
    expect(handValue([card("AS"), card("KS")]).total).toBe(21);
    expect(handValue([card("AS"), card("AS"), card("9H")]).total).toBe(21);
    expect(handValue([card("AS"), card("9H"), card("5C")]).total).toBe(15);
  });

  it("recognizes blackjack and pays 3:2", () => {
    expect(isBlackjack([card("AS"), card("QD")])).toBe(true);
    const settled = settleBlackjack(100n, [card("AS"), card("QD")], [card("9H"), card("8C")]);
    expect(settled.result).toBe("BLACKJACK");
    expect(settled.payout).toBe(250n);
  });

  it("settles win, push, lose and dealer bust", () => {
    expect(settleBlackjack(10n, [card("KH"), card("9C")], [card("KH"), card("8C")]).result).toBe("WIN");
    expect(settleBlackjack(10n, [card("KH"), card("8C")], [card("QD"), card("8H")]).result).toBe("PUSH");
    expect(settleBlackjack(10n, [card("KH"), card("6C")], [card("QD"), card("8H")]).result).toBe("LOSE");
    const bust = settleBlackjack(10n, [card("KH"), card("9C")], [card("KD"), card("6H"), card("9S")]);
    expect(bust.result).toBe("WIN");
    expect(bust.payout).toBe(20n);
  });

  it("dealer draws to 17 and stands", () => {
    const deck = [card("5S"), card("9D"), card("2C")];
    const played = dealerPlay([card("KH"), card("2H")], deck, 0);
    expect(handValue(played.cards).total).toBe(17);
    expect(played.deckPos).toBe(1);
  });
});

describe("video poker — jacks or better", () => {
  const hands: [string[], string][] = [
    [["TS", "JS", "QS", "KS", "AS"], "ROYAL_FLUSH"],
    [["5H", "6H", "7H", "8H", "9H"], "STRAIGHT_FLUSH"],
    [["9S", "9H", "9D", "9C", "2S"], "FOUR_OF_A_KIND"],
    [["9S", "9H", "9D", "2C", "2S"], "FULL_HOUSE"],
    [["2H", "5H", "9H", "JH", "KH"], "FLUSH"],
    [["5S", "6H", "7D", "8C", "9S"], "STRAIGHT"],
    [["AS", "2H", "3D", "4C", "5S"], "STRAIGHT"], // wheel: ace plays low
    [["9S", "9H", "9D", "2C", "5S"], "THREE_OF_A_KIND"],
    [["9S", "9H", "2D", "2C", "5S"], "TWO_PAIR"],
    [["JS", "JH", "2D", "5C", "9S"], "JACKS_OR_BETTER"],
    [["QS", "QH", "2D", "5C", "9S"], "JACKS_OR_BETTER"],
    [["AS", "AH", "2D", "5C", "9S"], "JACKS_OR_BETTER"],
    [["TS", "TH", "2D", "5C", "9S"], "NOTHING"], // tens don't pay
    [["2S", "4H", "6D", "8C", "JS"], "NOTHING"],
    [["TS", "JS", "QS", "KS", "9S"], "STRAIGHT_FLUSH"], // 9-K, not royal
  ];

  it.each(hands)("evaluates %j as %s", (codes, expected) => {
    expect(evaluateVideoPoker(codes.map(card))).toBe(expected);
  });

  it("pays per the 9/6 pay table", () => {
    expect(videoPokerPayout(5n, "ROYAL_FLUSH")).toBe(1250n);
    expect(videoPokerPayout(5n, "FULL_HOUSE")).toBe(45n);
    expect(videoPokerPayout(5n, "FLUSH")).toBe(30n);
    expect(videoPokerPayout(5n, "JACKS_OR_BETTER")).toBe(5n);
    expect(videoPokerPayout(5n, "NOTHING")).toBe(0n);
  });

  it("round-trips card codes", () => {
    expect(cardCode(card("AS"))).toBe("AS");
    expect(cardCode(card("TH"))).toBe("TH");
    expect(cardCode(card("2C"))).toBe("2C");
  });
});
