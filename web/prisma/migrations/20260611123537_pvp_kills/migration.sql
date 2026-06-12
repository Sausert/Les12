-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "bullets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diedAt" TIMESTAMP(3),
ADD COLUMN     "jailedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "KillAttempt" (
    "id" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "victimId" TEXT NOT NULL,
    "bulletsUsed" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "bloodMoney" BIGINT NOT NULL DEFAULT 0,
    "bountyPaid" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KillAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "seekerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("seekerId","targetId")
);

-- CreateTable
CREATE TABLE "Protection" (
    "playerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protection_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "BountyOrder" (
    "id" TEXT NOT NULL,
    "placerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fundTxHash" TEXT,
    "claimTxHash" TEXT,
    "claimedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BountyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JailEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "freedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityChange" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "oldUsername" TEXT NOT NULL,
    "newUsername" TEXT NOT NULL,
    "xpKept" BIGINT NOT NULL,
    "cost" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KillAttempt_createdAt_idx" ON "KillAttempt"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "BountyOrder_targetId_status_idx" ON "BountyOrder"("targetId", "status");

-- CreateIndex
CREATE INDEX "JailEvent_createdAt_idx" ON "JailEvent"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "KillAttempt" ADD CONSTRAINT "KillAttempt_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillAttempt" ADD CONSTRAINT "KillAttempt_victimId_fkey" FOREIGN KEY ("victimId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protection" ADD CONSTRAINT "Protection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyOrder" ADD CONSTRAINT "BountyOrder_placerId_fkey" FOREIGN KEY ("placerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyOrder" ADD CONSTRAINT "BountyOrder_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JailEvent" ADD CONSTRAINT "JailEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityChange" ADD CONSTRAINT "IdentityChange_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
