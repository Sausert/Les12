import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPlayerId } from "@/lib/session";
import type { Player } from "@prisma/client";

/** JSON response that survives BigInt fields. */
export function json(data: unknown, init?: ResponseInit): NextResponse {
  return new NextResponse(
    JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? Number(value) : value)),
    { ...init, headers: { "content-type": "application/json", ...init?.headers } },
  );
}

export function apiError(status: number, code: string, extra?: Record<string, unknown>) {
  return json({ error: code, ...extra }, { status });
}

export async function requirePlayer(): Promise<Player | NextResponse> {
  const playerId = await getSessionPlayerId();
  if (!playerId) return apiError(401, "unauthenticated");
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return apiError(401, "unauthenticated");
  return player;
}

/** Dead players can only look at the world (and respawn). */
export function requireAlive(player: Player): NextResponse | null {
  if (player.isDead) return apiError(403, "dead");
  return null;
}

/** Jailed players can't act until released or bribed out. */
export function requireFree(player: Player): NextResponse | null {
  if (player.jailedUntil && player.jailedUntil > new Date()) {
    return apiError(403, "jailed", { jailedUntil: player.jailedUntil.toISOString() });
  }
  return null;
}

// Minimal in-memory rate limiter: max 20 requests per 10s per player.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(playerId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(playerId);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(playerId, { count: 1, resetAt: now + 10_000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= 20;
}
