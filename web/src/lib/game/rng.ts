import { createHash, createHmac } from "node:crypto";

/**
 * Provably fair RNG: every byte is derived from
 * HMAC-SHA256(serverSeed, `${clientSeed}:${blockIndex}`). The server commits
 * to sha256(serverSeed) before the bet; after settling, the seed is revealed
 * so players can replay the exact stream and verify the outcome.
 */
export class SeededRng {
  private buffer: Buffer = Buffer.alloc(0);
  private offset = 0;
  private block = 0;

  constructor(
    private readonly serverSeed: string,
    private readonly clientSeed: string,
  ) {}

  private nextByte(): number {
    if (this.offset >= this.buffer.length) {
      this.buffer = createHmac("sha256", this.serverSeed)
        .update(`${this.clientSeed}:${this.block}`)
        .digest();
      this.block += 1;
      this.offset = 0;
    }
    const byte = this.buffer[this.offset];
    this.offset += 1;
    return byte;
  }

  /** Uniform integer in [0, max) via rejection sampling (no modulo bias). */
  nextInt(max: number): number {
    if (max <= 0 || max > 0x1000000) throw new Error("max out of range");
    const limit = Math.floor(0x1000000 / max) * max;
    for (;;) {
      const value = (this.nextByte() << 16) | (this.nextByte() << 8) | this.nextByte();
      if (value < limit) return value % max;
    }
  }
}

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}
