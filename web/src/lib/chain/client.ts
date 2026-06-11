import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployments from "./deployments.json";

export const chainEnabled = process.env.CHAIN_ENABLED === "true";

const chainId = Number(process.env.CHAIN_ID ?? 57054);
const rpcUrl = process.env.CHAIN_RPC_URL ?? "https://rpc.blaze.soniclabs.com";

export const gameChain = defineChain({
  id: chainId,
  name: chainId === 57054 ? "Sonic Blaze Testnet" : chainId === 146 ? "Sonic" : "Local",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers:
    chainId === 57054
      ? { default: { name: "Sonic Blaze Explorer", url: "https://testnet.sonicscan.org" } }
      : undefined,
});

export const tokenAddress = (deployments.omertaToken ?? null) as Address | null;
export const bankAddress = (deployments.bank ?? null) as Address | null;

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
