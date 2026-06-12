-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'nl',
    "rankId" INTEGER NOT NULL DEFAULT 1,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "cash" BIGINT NOT NULL DEFAULT 500,
    "dirtyCash" BIGINT NOT NULL DEFAULT 0,
    "heat" INTEGER NOT NULL DEFAULT 0,
    "walletAddress" TEXT,
    "walletKeyEnc" TEXT,
    "isDead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rank" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "minXp" BIGINT NOT NULL,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crime" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "minRankId" INTEGER NOT NULL,
    "cooldownSec" INTEGER NOT NULL,
    "baseSuccess" INTEGER NOT NULL,
    "minPayout" INTEGER NOT NULL,
    "maxPayout" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "heatGain" INTEGER NOT NULL,

    CONSTRAINT "Crime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeAttempt" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "crimeId" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "payout" BIGINT NOT NULL,
    "xpGained" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrimeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooldown" (
    "playerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cooldown_pkey" PRIMARY KEY ("playerId","key")
);

-- CreateTable
CREATE TABLE "ChainTx" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainTx_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Player_walletAddress_key" ON "Player"("walletAddress");

-- CreateIndex
CREATE INDEX "Player_xp_idx" ON "Player"("xp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Rank_key_key" ON "Rank"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Crime_key_key" ON "Crime"("key");

-- CreateIndex
CREATE INDEX "CrimeAttempt_playerId_createdAt_idx" ON "CrimeAttempt"("playerId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ChainTx_txHash_key" ON "ChainTx"("txHash");

-- CreateIndex
CREATE INDEX "ChainTx_playerId_createdAt_idx" ON "ChainTx"("playerId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeAttempt" ADD CONSTRAINT "CrimeAttempt_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeAttempt" ADD CONSTRAINT "CrimeAttempt_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooldown" ADD CONSTRAINT "Cooldown_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainTx" ADD CONSTRAINT "ChainTx_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
