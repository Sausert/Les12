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

async function main() {
  for (const rank of ranks) {
    await prisma.rank.upsert({ where: { id: rank.id }, update: rank, create: rank });
  }
  for (const crime of crimes) {
    await prisma.crime.upsert({ where: { id: crime.id }, update: crime, create: crime });
  }

  const passwordHash = await bcrypt.hash("hush-hush-1930", 10);
  for (const username of ["DonTesto", "LuckyLuciana"]) {
    await prisma.player.upsert({
      where: { username },
      update: {},
      create: { username, passwordHash, locale: "nl" },
    });
  }

  console.log(`Seeded ${ranks.length} ranks, ${crimes.length} crimes, 2 test players.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
