import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { json, apiError } from "@/lib/api";
import { createCustodialWallet } from "@/lib/chain/wallet";

const bodySchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100),
  email: z.email().optional(),
  locale: z.enum(["nl", "en"]).default("nl"),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const { username, password, email, locale } = parsed.data;

  const existing = await db.player.findFirst({
    where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
  });
  if (existing) return apiError(409, "username_taken");

  const wallet = createCustodialWallet();
  const player = await db.player.create({
    data: {
      username,
      email,
      locale,
      passwordHash: await bcrypt.hash(password, 10),
      walletAddress: wallet.address,
      walletKeyEnc: wallet.keyEnc,
    },
  });

  await createSession(player.id);
  return json({ id: player.id, username: player.username, walletAddress: wallet.address }, { status: 201 });
}
