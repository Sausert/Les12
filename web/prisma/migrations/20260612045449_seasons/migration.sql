-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "payoutAddress" TEXT;

-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonResult" (
    "seasonId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "xp" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "trophyTokenId" BIGINT,
    "trophyTxHash" TEXT,

    CONSTRAINT "SeasonResult_pkey" PRIMARY KEY ("seasonId","position")
);

-- AddForeignKey
ALTER TABLE "SeasonResult" ADD CONSTRAINT "SeasonResult_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonResult" ADD CONSTRAINT "SeasonResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
