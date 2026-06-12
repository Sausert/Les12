import { decodeEventLog, type Address } from "viem";
import { auctionHouseAbi, omertaItemsAbi, omertaTokenAbi } from "./abi";
import { auctionHouseAddress, itemsAddress, publicClient, tokenAddress } from "./client";
import { playerWalletClient } from "./wallet";
import { ensureGasFor, toWei } from "./token";

function requireAuction(): { auctionHouse: Address; items: Address; token: Address } {
  if (!auctionHouseAddress || !itemsAddress || !tokenAddress) {
    throw new Error("AuctionHouse not deployed — run contracts/scripts/deploy.ts first");
  }
  return { auctionHouse: auctionHouseAddress, items: itemsAddress, token: tokenAddress };
}

/** Seller (custodial) approves and escrows the NFT; returns on-chain auction id. */
export async function createAuctionOnChain(
  sellerId: string,
  tokenId: bigint,
  startPriceOmd: bigint,
  durationSec: number,
): Promise<{ auctionId: bigint; txHash: `0x${string}` }> {
  const { auctionHouse, items } = requireAuction();
  const wallet = await playerWalletClient(sellerId);
  if (!wallet.account) throw new Error("Wallet has no account");
  await ensureGasFor(wallet.account.address);

  const approveHash = await wallet.writeContract({
    address: items,
    abi: omertaItemsAbi,
    functionName: "approve",
    args: [auctionHouse, tokenId],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const txHash = await wallet.writeContract({
    address: auctionHouse,
    abi: auctionHouseAbi,
    functionName: "createAuction",
    args: [tokenId, toWei(startPriceOmd), BigInt(durationSec)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({ abi: auctionHouseAbi, data: log.data, topics: log.topics });
      if (event.eventName === "AuctionCreated") {
        return { auctionId: event.args.auctionId, txHash };
      }
    } catch {
      // not an AuctionHouse event
    }
  }
  throw new Error("AuctionCreated event missing from receipt");
}

/** Bidder (custodial) approves the bid amount and bids; OMD must be on-chain. */
export async function bidOnChain(
  bidderId: string,
  auctionId: bigint,
  amountOmd: bigint,
): Promise<`0x${string}`> {
  const { auctionHouse, token } = requireAuction();
  const wallet = await playerWalletClient(bidderId);
  if (!wallet.account) throw new Error("Wallet has no account");
  await ensureGasFor(wallet.account.address);
  const amount = toWei(amountOmd);

  const approveHash = await wallet.writeContract({
    address: token,
    abi: omertaTokenAbi,
    functionName: "approve",
    args: [auctionHouse, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const bidHash = await wallet.writeContract({
    address: auctionHouse,
    abi: auctionHouseAbi,
    functionName: "bid",
    args: [auctionId, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: bidHash });
  return bidHash;
}

/** Anyone may settle; the server does it on behalf of whoever asks first. */
export async function settleOnChain(
  callerId: string,
  auctionId: bigint,
): Promise<`0x${string}`> {
  const { auctionHouse } = requireAuction();
  const wallet = await playerWalletClient(callerId);
  if (!wallet.account) throw new Error("Wallet has no account");
  await ensureGasFor(wallet.account.address);
  const txHash = await wallet.writeContract({
    address: auctionHouse,
    abi: auctionHouseAbi,
    functionName: "settle",
    args: [auctionId],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
