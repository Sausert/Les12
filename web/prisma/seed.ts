import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Rank keys map to i18n messages: ranks.<key>
const ranks = [
  { id: 1, key: "empty_suit", minXp: 0n },
  { id: 2, key: "delivery_boy", minXp: 100n },
  { id: 3, key: "picciotto", minXp: 350n },
  { id: 4, key: "shoplifter", minXp: 800n },
  { id: 5, key: "pickpocket", minXp: 1600n },
  { id: 6, key: "thief", minXp: 3000n },
  { id: 7, key: "associate", minXp: 5500n },
  { id: 8, key: "mobster", minXp: 10000n },
  { id: 9, key: "soldier", minXp: 18000n },
  { id: 10, key: "swindler", minXp: 30000n },
  { id: 11, key: "assassin", minXp: 50000n },
  { id: 12, key: "local_chief", minXp: 80000n },
  { id: 13, key: "chief", minXp: 125000n },
  { id: 14, key: "bruglione", minXp: 190000n },
  { id: 15, key: "capodecina", minXp: 280000n },
  { id: 16, key: "godfather", minXp: 400000n },
];

// Crime keys map to i18n messages: crimes.<key>
const crimes = [
  { id: 1, key: "pickpocket", minRankId: 1, cooldownSec: 60, baseSuccess: 80, minPayout: 10, maxPayout: 40, xpReward: 8, heatGain: 1 },
  { id: 2, key: "beg_streets", minRankId: 1, cooldownSec: 90, baseSuccess: 90, minPayout: 5, maxPayout: 20, xpReward: 5, heatGain: 0 },
  { id: 3, key: "rob_drunk", minRankId: 2, cooldownSec: 150, baseSuccess: 70, minPayout: 30, maxPayout: 90, xpReward: 15, heatGain: 2 },
  { id: 4, key: "burgle_house", minRankId: 3, cooldownSec: 300, baseSuccess: 60, minPayout: 80, maxPayout: 220, xpReward: 30, heatGain: 4 },
  { id: 5, key: "steal_car", minRankId: 4, cooldownSec: 480, baseSuccess: 55, minPayout: 150, maxPayout: 450, xpReward: 55, heatGain: 6 },
  { id: 6, key: "extort_shop", minRankId: 6, cooldownSec: 900, baseSuccess: 50, minPayout: 350, maxPayout: 900, xpReward: 110, heatGain: 9 },
  { id: 7, key: "hijack_truck", minRankId: 8, cooldownSec: 1800, baseSuccess: 45, minPayout: 800, maxPayout: 2200, xpReward: 240, heatGain: 13 },
  { id: 8, key: "rob_bank", minRankId: 10, cooldownSec: 3600, baseSuccess: 35, minPayout: 2500, maxPayout: 8000, xpReward: 600, heatGain: 20 },
];

// District keys map to i18n messages: districts.<key>
const districts = [
  { id: 1, key: "slums", taxPct: 5 },
  { id: 2, key: "docks", taxPct: 5 },
  { id: 3, key: "market", taxPct: 5 },
  { id: 4, key: "little_italy", taxPct: 5 },
  { id: 5, key: "theater", taxPct: 5 },
  { id: 6, key: "harbor", taxPct: 5 },
];

// Market pools: uneven goods reserves create smuggling routes between
// districts (cash reserve 10000 everywhere; spot price = cash/goods).
const marketPools: { districtId: number; goodsKey: string; goodsReserve: bigint }[] = [
  { districtId: 1, goodsKey: "whiskey", goodsReserve: 1500n },
  { districtId: 1, goodsKey: "cigars", goodsReserve: 800n },
  { districtId: 1, goodsKey: "morphine", goodsReserve: 300n },
  { districtId: 2, goodsKey: "whiskey", goodsReserve: 2500n },
  { districtId: 2, goodsKey: "cigars", goodsReserve: 1000n },
  { districtId: 2, goodsKey: "morphine", goodsReserve: 500n },
  { districtId: 3, goodsKey: "whiskey", goodsReserve: 1000n },
  { districtId: 3, goodsKey: "cigars", goodsReserve: 2000n },
  { districtId: 3, goodsKey: "morphine", goodsReserve: 400n },
  { districtId: 4, goodsKey: "whiskey", goodsReserve: 800n },
  { districtId: 4, goodsKey: "cigars", goodsReserve: 1200n },
  { districtId: 4, goodsKey: "morphine", goodsReserve: 600n },
  { districtId: 5, goodsKey: "whiskey", goodsReserve: 500n },
  { districtId: 5, goodsKey: "cigars", goodsReserve: 600n },
  { districtId: 5, goodsKey: "morphine", goodsReserve: 800n },
  { districtId: 6, goodsKey: "whiskey", goodsReserve: 2000n },
  { districtId: 6, goodsKey: "cigars", goodsReserve: 900n },
  { districtId: 6, goodsKey: "morphine", goodsReserve: 1000n },
];

// Item keys map to i18n messages: items.<key>; metadata in public/nft/<key>.json
const itemTypes = [
  { id: 1, key: "revolver", category: "WEAPON", price: 800n, effectPct: 10, yieldPerDay: 0 },
  { id: 2, key: "tommy_gun", category: "WEAPON", price: 2500n, effectPct: 20, yieldPerDay: 0 },
  { id: 3, key: "ford_model_a", category: "CAR", price: 600n, effectPct: 25, yieldPerDay: 0 },
  { id: 4, key: "cadillac_v16", category: "CAR", price: 2000n, effectPct: 50, yieldPerDay: 0 },
  { id: 5, key: "speakeasy", category: "PROPERTY", price: 1500n, effectPct: 0, yieldPerDay: 25 },
  { id: 6, key: "docks_warehouse", category: "PROPERTY", price: 3500n, effectPct: 0, yieldPerDay: 60 },
  { id: 7, key: "grand_casino_share", category: "PROPERTY", price: 8000n, effectPct: 0, yieldPerDay: 150 },
];

async function main() {
  for (const rank of ranks) {
    await prisma.rank.upsert({ where: { id: rank.id }, update: rank, create: rank });
  }
  for (const crime of crimes) {
    await prisma.crime.upsert({ where: { id: crime.id }, update: crime, create: crime });
  }
  for (const district of districts) {
    await prisma.district.upsert({
      where: { id: district.id },
      update: { key: district.key, taxPct: district.taxPct },
      create: district,
    });
  }
  for (const itemType of itemTypes) {
    await prisma.itemType.upsert({
      where: { id: itemType.id },
      update: itemType,
      create: itemType,
    });
  }
  for (const pool of marketPools) {
    await prisma.marketPool.upsert({
      where: { districtId_goodsKey: { districtId: pool.districtId, goodsKey: pool.goodsKey } },
      update: {}, // never reset live reserves
      create: { ...pool, cashReserve: 10_000n },
    });
  }

  // Season 1 opens with the city.
  const activeSeason = await prisma.season.findFirst({ where: { status: "ACTIVE" } });
  if (!activeSeason) {
    const last = await prisma.season.findFirst({ orderBy: { id: "desc" } });
    await prisma.season.create({ data: { id: (last?.id ?? 0) + 1 } });
  }

  const passwordHash = await bcrypt.hash("hush-hush-1930", 10);
  for (const username of ["DonTesto", "LuckyLuciana"]) {
    await prisma.player.upsert({
      where: { username },
      update: {},
      create: { username, passwordHash, locale: "nl" },
    });
  }

  console.log(`Seeded ${ranks.length} ranks, ${crimes.length} crimes, ${districts.length} districts, 2 test players.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
