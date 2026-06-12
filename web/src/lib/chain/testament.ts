import { randomBytes } from "node:crypto";
import { bytesToBigInt, maxUint256, type Address } from "viem";
import { omertaTokenAbi, testamentAbi } from "./abi";
import { gameChain, publicClient, testamentAddress, tokenAddress, treasuryWalletClient } from "./client";
import { playerWalletClient } from "./wallet";
import { ensureGasFor } from "./token";

function requireTestament(): { testament: Address; token: Address } {
  if (!testamentAddress || !tokenAddress) {
    throw new Error("Testament not deployed — run contracts/scripts/deploy.ts first");
  }
  return { testament: testamentAddress, token: tokenAddress };
}

/**
 * Executes a player's on-chain will: the custodial wallet names the heir and
 * approves the contract, the treasury signs the EIP-712 death attest, and the
 * contract enforces the 60/40 inherit/burn split.
 */
export async function executeTestamentOnChain(
  deceasedId: string,
  deceasedAddress: Address,
  heirAddress: Address,
): Promise<`0x${string}`> {
  const { testament, token } = requireTestament();
  const wallet = await playerWalletClient(deceasedId);
  if (!wallet.account) throw new Error("Wallet has no account");
  await ensureGasFor(deceasedAddress);

  const approveHash = await wallet.writeContract({
    address: token,
    abi: omertaTokenAbi,
    functionName: "approve",
    args: [testament, maxUint256],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const nameHash = await wallet.writeContract({
    address: testament,
    abi: testamentAbi,
    functionName: "nameHeir",
    args: [heirAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: nameHash });

  const treasury = treasuryWalletClient();
  const nonce = bytesToBigInt(randomBytes(32));
  const signature = await treasury.signTypedData({
    domain: {
      name: "SonicOmertaTestament",
      version: "1",
      chainId: gameChain.id,
      verifyingContract: testament,
    },
    types: {
      DeathAttest: [
        { name: "deceased", type: "address" },
        { name: "heir", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
    },
    primaryType: "DeathAttest",
    message: { deceased: deceasedAddress, heir: heirAddress, nonce },
  });

  const executeHash = await treasury.writeContract({
    address: testament,
    abi: testamentAbi,
    functionName: "execute",
    args: [deceasedAddress, heirAddress, nonce, signature],
  });
  await publicClient.waitForTransactionReceipt({ hash: executeHash });
  return executeHash;
}
