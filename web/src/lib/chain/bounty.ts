import { randomBytes } from "node:crypto";
import { bytesToBigInt, type Address } from "viem";
import { omertaTokenAbi } from "./abi";
import { bountyAbi } from "./abi";
import { bountyAddress, gameChain, publicClient, tokenAddress, treasuryWalletClient } from "./client";
import { toWei } from "./token";

function requireBounty(): { token: Address; bounty: Address } {
  if (!tokenAddress || !bountyAddress) {
    throw new Error("Bounty contract not deployed — run contracts/scripts/deploy.ts first");
  }
  return { token: tokenAddress, bounty: bountyAddress };
}

/**
 * Locks `omd` on `target`'s head in the on-chain escrow. The pot is funded by
 * freshly minted tokens (the placer's off-chain cash was already debited), so
 * the treasury mints to itself, approves, and funds in one go.
 */
export async function fundBountyOnChain(target: Address, omd: bigint): Promise<`0x${string}`> {
  const { token, bounty } = requireBounty();
  const treasury = treasuryWalletClient();
  const amount = toWei(omd);
  const self = treasury.account.address;

  const mintHash = await treasury.writeContract({
    address: token,
    abi: omertaTokenAbi,
    functionName: "mint",
    args: [self, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  const approveHash = await treasury.writeContract({
    address: token,
    abi: omertaTokenAbi,
    functionName: "approve",
    args: [bounty, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const fundHash = await treasury.writeContract({
    address: bounty,
    abi: bountyAbi,
    functionName: "fund",
    args: [target, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  return fundHash;
}

/**
 * Pays the whole on-chain pot on `target` out to `killer`: the treasury signs
 * an EIP-712 KillAttest and submits the claim itself (no gas needed from the
 * killer's wallet).
 */
export async function claimBountyOnChain(
  target: Address,
  killer: Address,
): Promise<`0x${string}`> {
  const { bounty } = requireBounty();
  const treasury = treasuryWalletClient();
  const nonce = bytesToBigInt(randomBytes(32));

  const signature = await treasury.signTypedData({
    domain: {
      name: "SonicOmertaBounty",
      version: "1",
      chainId: gameChain.id,
      verifyingContract: bounty,
    },
    types: {
      KillAttest: [
        { name: "target", type: "address" },
        { name: "killer", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
    },
    primaryType: "KillAttest",
    message: { target, killer, nonce },
  });

  const claimHash = await treasury.writeContract({
    address: bounty,
    abi: bountyAbi,
    functionName: "claim",
    args: [target, killer, nonce, signature],
  });
  await publicClient.waitForTransactionReceipt({ hash: claimHash });
  return claimHash;
}
