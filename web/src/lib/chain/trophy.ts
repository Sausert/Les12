import { decodeEventLog, type Address } from "viem";
import { seasonTrophyAbi } from "./abi";
import { publicClient, seasonTrophyAddress, treasuryWalletClient } from "./client";

function requireTrophy(): Address {
  if (!seasonTrophyAddress) {
    throw new Error("SeasonTrophy not deployed — run contracts/scripts/deploy.ts first");
  }
  return seasonTrophyAddress;
}

/** Mints a soulbound season trophy; returns tokenId and tx hash. */
export async function mintTrophyTo(
  to: Address,
  season: number,
  position: number,
): Promise<{ tokenId: bigint; txHash: `0x${string}` }> {
  const trophy = requireTrophy();
  const treasury = treasuryWalletClient();
  const txHash = await treasury.writeContract({
    address: trophy,
    abi: seasonTrophyAbi,
    functionName: "mintTrophy",
    args: [to, season, position],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({ abi: seasonTrophyAbi, data: log.data, topics: log.topics });
      if (event.eventName === "TrophyMinted") {
        return { tokenId: event.args.tokenId, txHash };
      }
    } catch {
      // not a SeasonTrophy event
    }
  }
  throw new Error("TrophyMinted event missing from receipt");
}
