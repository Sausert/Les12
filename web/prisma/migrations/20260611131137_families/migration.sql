-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "districtId" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "treasury" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "playerId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SOLDIER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "FamilyInvite" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "taxPct" INTEGER NOT NULL DEFAULT 5,
    "ownerFamilyId" TEXT,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurfWar" (
    "id" TEXT NOT NULL,
    "districtId" INTEGER NOT NULL,
    "attackerFamilyId" TEXT NOT NULL,
    "defenderFamilyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "endsAt" TIMESTAMP(3) NOT NULL,
    "winnerFamilyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurfWar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Heist" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "payoutEach" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "Heist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeistRole" (
    "heistId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "HeistRole_pkey" PRIMARY KEY ("heistId","role")
);

-- CreateTable
CREATE TABLE "Betrayal" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reward" BIGINT NOT NULL,
    "exposed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Betrayal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Family_name_key" ON "Family"("name");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_familyId_playerId_key" ON "FamilyInvite"("familyId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "District_key_key" ON "District"("key");

-- CreateIndex
CREATE INDEX "TurfWar_status_endsAt_idx" ON "TurfWar"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Heist_familyId_status_idx" ON "Heist"("familyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HeistRole_heistId_playerId_key" ON "HeistRole"("heistId", "playerId");

-- CreateIndex
CREATE INDEX "Betrayal_familyId_createdAt_idx" ON "Betrayal"("familyId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_ownerFamilyId_fkey" FOREIGN KEY ("ownerFamilyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurfWar" ADD CONSTRAINT "TurfWar_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurfWar" ADD CONSTRAINT "TurfWar_attackerFamilyId_fkey" FOREIGN KEY ("attackerFamilyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurfWar" ADD CONSTRAINT "TurfWar_defenderFamilyId_fkey" FOREIGN KEY ("defenderFamilyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Heist" ADD CONSTRAINT "Heist_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeistRole" ADD CONSTRAINT "HeistRole_heistId_fkey" FOREIGN KEY ("heistId") REFERENCES "Heist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeistRole" ADD CONSTRAINT "HeistRole_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Betrayal" ADD CONSTRAINT "Betrayal_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Betrayal" ADD CONSTRAINT "Betrayal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
