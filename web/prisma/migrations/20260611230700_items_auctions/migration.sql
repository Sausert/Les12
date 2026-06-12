-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "retiredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ItemType" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "effectPct" INTEGER NOT NULL DEFAULT 0,
    "yieldPerDay" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemTypeId" INTEGER NOT NULL,
    "ownerId" TEXT,
    "tokenId" BIGINT,
    "mintTxHash" TEXT,
    "escrowed" BOOLEAN NOT NULL DEFAULT false,
    "lastYieldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "onchainId" BIGINT,
    "itemId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "startPrice" BIGINT NOT NULL,
    "highBid" BIGINT NOT NULL DEFAULT 0,
    "highBidderId" TEXT,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "settleTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemType_key_key" ON "ItemType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Item_tokenId_key" ON "Item"("tokenId");

-- CreateIndex
CREATE INDEX "Item_ownerId_idx" ON "Item"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_onchainId_key" ON "Auction"("onchainId");

-- CreateIndex
CREATE INDEX "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "ItemType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_highBidderId_fkey" FOREIGN KEY ("highBidderId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
