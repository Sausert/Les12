import { decodeEventLog, type Address } from "viem";
import { omertaItemsAbi } from "./abi";
import { itemsAddress, publicClient, treasuryWalletClient } from "./client";

function requireItems(): Address {
  if (!itemsAddress) {
    throw new Error("OmertaItems not deployed — run contracts/scripts/deploy.ts first");
  }
  return itemsAddress;
}

/** Mints an item NFT to the player's wallet; returns tokenId and tx hash. */
export async function mintItemTo(
  to: Address,
  itemTypeId: number,
  uri: string,
): Promise<{ tokenId: bigint; txHash: `0x${string}` }> {
  const items = requireItems();
  const treasury = treasuryWalletClient();
  const txHash = await treasury.writeContract({
    address: items,
    abi: omertaItemsAbi,
    functionName: "mintItem",
    args: [to, BigInt(itemTypeId), uri],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({ abi: omertaItemsAbi, data: log.data, topics: log.topics });
      if (event.eventName === "ItemMinted") {
        return { tokenId: event.args.tokenId, txHash };
      }
    } catch {
      // not an OmertaItems event
    }
  }
  throw new Error("ItemMinted event missing from receipt");
}

export async function itemOwnerOf(tokenId: bigint): Promise<Address> {
  return publicClient.readContract({
    address: requireItems(),
    abi: omertaItemsAbi,
    functionName: "ownerOf",
    args: [tokenId],
  });
}
