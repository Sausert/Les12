import { NextResponse } from "next/server";
import { z } from "zod";
import { isAddress, verifyMessage, type Address } from "viem";
import { db } from "@/lib/db";
import { json, apiError, requirePlayer, requireAlive, rateLimit } from "@/lib/api";
import { linkMessage } from "@/lib/server/wallet-link";

/** The exact message the external wallet must sign (shown in the UI). */
export async function GET(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) return apiError(400, "invalid_address");
  return json({ message: linkMessage(player.username, address) });
}

const bodySchema = z.object({
  address: z.string(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

/**
 * Links an external wallet by proof of ownership: the wallet signs the
 * challenge message (personal_sign) and we verify the signature server-side.
 * Withdrawals can then pay out to this address.
 */
export async function POST(request: Request) {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  if (!rateLimit(player.id)) return apiError(429, "rate_limited");
  const blocked = requireAlive(player);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const { address, signature } = parsed.data;
  if (!isAddress(address)) return apiError(400, "invalid_address");

  const valid = await verifyMessage({
    address: address as Address,
    message: linkMessage(player.username, address),
    signature: signature as `0x${string}`,
  }).catch(() => false);
  if (!valid) return apiError(400, "invalid_signature");

  await db.player.update({
    where: { id: player.id },
    data: { payoutAddress: address },
  });
  return json({ payoutAddress: address });
}

/** Unlink the external wallet. */
export async function DELETE() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;
  await db.player.update({ where: { id: player.id }, data: { payoutAddress: null } });
  return json({ payoutAddress: null });
}
