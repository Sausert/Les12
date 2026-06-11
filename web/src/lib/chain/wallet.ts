import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createWalletClient, http, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { db } from "@/lib/db";
import { gameChain } from "./client";

/**
 * Custodial wallet seam. Every player gets a server-generated keypair whose
 * private key is stored AES-256-GCM encrypted. All signing goes through
 * playerWalletClient(), so swapping in an external wallet provider (Privy,
 * WalletConnect) later only touches this module.
 */

function encryptionKey(): Buffer {
  const hex = process.env.WALLET_ENC_KEY;
  if (!hex || Buffer.from(hex, "hex").length !== 32) {
    throw new Error("WALLET_ENC_KEY must be 32 bytes of hex");
  }
  return Buffer.from(hex, "hex");
}

export function encryptPrivateKey(privateKey: `0x${string}`): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptPrivateKey(encoded: string): `0x${string}` {
  const [iv, tag, data] = encoded.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8") as `0x${string}`;
}

export function createCustodialWallet(): { address: Address; keyEnc: string } {
  const privateKey = generatePrivateKey();
  return {
    address: privateKeyToAccount(privateKey).address,
    keyEnc: encryptPrivateKey(privateKey),
  };
}

/** Wallet client signing as the given player's custodial account. */
export async function playerWalletClient(playerId: string) {
  const player = await db.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { walletKeyEnc: true },
  });
  if (!player.walletKeyEnc) throw new Error("Player has no wallet");
  const account = privateKeyToAccount(decryptPrivateKey(player.walletKeyEnc));
  return createWalletClient({ chain: gameChain, transport: http(), account });
}
