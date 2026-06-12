import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { json, apiError } from "@/lib/api";

const bodySchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input");
  const { username, password } = parsed.data;

  const player = await db.player.findUnique({ where: { username } });
  if (!player || !(await bcrypt.compare(password, player.passwordHash))) {
    return apiError(401, "invalid_credentials");
  }

  await createSession(player.id);
  return json({ id: player.id, username: player.username });
}
