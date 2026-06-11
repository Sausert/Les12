import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, requirePlayer } from "@/lib/api";
import { resolveDueWars } from "@/lib/server/wars";

export async function GET() {
  const player = await requirePlayer();
  if (player instanceof NextResponse) return player;

  await resolveDueWars();

  const districts = await db.district.findMany({
    orderBy: { id: "asc" },
    include: {
      ownerFamily: { select: { name: true } },
      wars: { where: { status: "PENDING" }, select: { endsAt: true } },
    },
  });

  return json(
    districts.map((district) => ({
      id: district.id,
      key: district.key,
      taxPct: district.taxPct,
      ownerFamilyName: district.ownerFamily?.name ?? null,
      underAttack: district.wars.length > 0,
      warEndsAt: district.wars[0]?.endsAt.toISOString() ?? null,
      isHere: district.id === player.districtId,
    })),
  );
}
