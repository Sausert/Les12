import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployments from "./deployments.json";

export const chainEnabled = process.env.CHAIN_ENABLED === "true";

const chainId = Number(process.env.CHAIN_ID ?? 14601);
const rpcUrl = process.env.CHAIN_RPC_URL ?? "https://rpc.testnet.soniclabs.com";

export const gameChain = defineChain({
  id: chainId,
  name: chainId === 14601 ? "Sonic Testnet" : chainId === 146 ? "Sonic" : "Local",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers:
    chainId === 14601
      ? { default: { name: "Sonic Testnet Explorer", url: "https://testnet.sonicscan.org" } }
      : undefined,
});

const addresses = deployments as {
  omertaToken: string | null;
  bank: string | null;
  bounty?: string | null;
  omertaItems?: string | null;
  auctionHouse?: string | null;
  testament?: string | null;
  seasonTrophy?: string | null;
};

export const tokenAddress = (addresses.omertaToken ?? null) as Address | null;
export const bankAddress = (addresses.bank ?? null) as Address | null;
export const bountyAddress = (addresses.bounty ?? null) as Address | null;
export const itemsAddress = (addresses.omertaItems ?? null) as Address | null;
export const auctionHouseAddress = (addresses.auctionHouse ?? null) as Address | null;
export const testamentAddress = (addresses.testament ?? null) as Address | null;
export const seasonTrophyAddress = (addresses.seasonTrophy ?? null) as Address | null;

export const publicClient = createPublicClient({ chain: gameChain, transport: http() });

export function treasuryWalletClient() {
  const key = process.env.TREASURY_PRIVATE_KEY;
  if (!key) throw new Error("TREASURY_PRIVATE_KEY is not set");
  return createWalletClient({
    chain: gameChain,
    transport: http(),
    account: privateKeyToAccount(key as `0x${string}`),
  });
}

export function explorerTxUrl(txHash: string): string | null {
  const explorer = gameChain.blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${txHash}` : null;
}
