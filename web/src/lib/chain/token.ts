import { parseEther, type Address } from "viem";
import { omertaTokenAbi, bankAbi } from "./abi";
import { bankAddress, publicClient, tokenAddress, treasuryWalletClient } from "./client";
import { playerWalletClient } from "./wallet";

/**
 * Chain boundary for OMD. Off-chain balances are whole OMD units; the 18
 * decimals conversion happens exclusively here.
 */

function requireAddresses(): { token: Address; bank: Address } {
  if (!tokenAddress || !bankAddress) {
    throw new Error("Contracts not deployed — run contracts/scripts/deploy.ts first");
  }
  return { token: tokenAddress, bank: bankAddress };
}

export function toWei(omd: bigint): bigint {
  return parseEther(omd.toString());
}

/** Mints `omd` whole tokens to `to` (treasury signs). Returns the tx hash. */
export async function mintTo(to: Address, omd: bigint): Promise<`0x${string}`> {
  const { token } = requireAddresses();
  const treasury = treasuryWalletClient();
  const hash = await treasury.writeContract({
    address: token,
    abi: omertaTokenAbi,
    functionName: "mint",
    args: [to, toWei(omd)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Custodial wallets hold no native S; the treasury tops up gas when needed. */
export async function ensureGasFor(address: Address): Promise<void> {
  const balance = await publicClient.getBalance({ address });
  if (balance >= parseEther("0.005")) return;
  const treasury = treasuryWalletClient();
  const hash = await treasury.sendTransaction({ to: address, value: parseEther("0.01") });
  await publicClient.waitForTransactionReceipt({ hash });
}

/** Burns `omd` from the player's custodial wallet via Bank.deposit. */
export async function depositFor(playerId: string, omd: bigint): Promise<`0x${string}`> {
  const { token, bank } = requireAddresses();
  const wallet = await playerWalletClient(playerId);
  if (!wallet.account) throw new Error("Wallet has no account");
  await ensureGasFor(wallet.account.address);
  const amount = toWei(omd);

  const approveHash = await wallet.writeContract({
    address: token,
    abi: omertaTokenAbi,
    functionName: "approve",
    args: [bank, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const depositHash = await wallet.writeContract({
    address: bank,
    abi: bankAbi,
    functionName: "deposit",
    args: [amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  return depositHash;
}

/** On-chain OMD balance in whole tokens (floor). */
export async function onChainBalance(address: Address): Promise<bigint> {
  const { token } = requireAddresses();
  const wei = await publicClient.readContract({
    address: token,
    abi: omertaTokenAbi,
    functionName: "balanceOf",
    args: [address],
  });
  return wei / 10n ** 18n;
}
