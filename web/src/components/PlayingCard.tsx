"use client";

import { motion } from "framer-motion";

const SUIT_GLYPHS: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

/** A card code like "AS" or "TH" rendered as a small noir playing card. */
export function PlayingCard({
  code,
  held,
  onClick,
  delay = 0,
}: {
  code: string;
  held?: boolean;
  onClick?: () => void;
  delay?: number;
}) {
  const rank = code[0] === "T" ? "10" : code[0];
  const suit = SUIT_GLYPHS[code[1]] ?? code[1];
  const red = code[1] === "H" || code[1] === "D";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ delay, duration: 0.25 }}
      className={`relative flex h-16 w-11 flex-col items-center justify-center rounded border bg-ivory font-display text-lg shadow-md ${
        red ? "text-blood" : "text-night"
      } ${held ? "border-gold ring-2 ring-gold" : "border-night/30"} ${
        onClick ? "cursor-pointer active:scale-95" : ""
      }`}
    >
      <span className="leading-none">{rank}</span>
      <span className="text-base leading-none">{suit}</span>
      {held && (
        <span className="absolute -top-2 rounded bg-gold px-1 font-body text-[0.55rem] uppercase text-night">
          hold
        </span>
      )}
    </motion.button>
  );
}
