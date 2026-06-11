-- CreateTable
CREATE TABLE "CasinoRound" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "game" TEXT,
    "bet" BIGINT NOT NULL DEFAULT 0,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT,
    "state" JSONB,
    "outcome" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMMITTED',
    "payout" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "CasinoRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPool" (
    "districtId" INTEGER NOT NULL,
    "goodsKey" TEXT NOT NULL,
    "goodsReserve" BIGINT NOT NULL,
    "cashReserve" BIGINT NOT NULL,

    CONSTRAINT "MarketPool_pkey" PRIMARY KEY ("districtId","goodsKey")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "playerId" TEXT NOT NULL,
    "goodsKey" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("playerId","goodsKey")
);

-- CreateIndex
CREATE INDEX "CasinoRound_playerId_createdAt_idx" ON "CasinoRound"("playerId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "CasinoRound" ADD CONSTRAINT "CasinoRound_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
