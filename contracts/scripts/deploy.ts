import hre from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineChain } from "viem";

const sonicBlazeChain = defineChain({
  id: 14601,
  name: "Sonic Blaze Testnet",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.SONIC_BLAZE_RPC ?? "https://rpc.testnet.soniclabs.com"] },
  },
});

/**
 * Deploys OmertaToken + Bank. The deployer account (TREASURY_PRIVATE_KEY on
 * sonicBlaze) becomes both admin and minter, and the addresses are written to
 * web/src/lib/chain/deployments.json for the game server to pick up.
 */
async function main() {
  const chainOverride = hre.network.config.chainId === 14601 ? { chain: sonicBlazeChain } : {};

  // Pre-create the clients with the custom chain so hardhat-viem never has to
  // resolve chain id 14601 itself (it isn't in viem's built-in chain list).
  const publicClient = await hre.viem.getPublicClient(chainOverride);
  const [deployer] = await hre.viem.getWalletClients(chainOverride);
  if (!deployer) {
    throw new Error(
      "No deployer account. Set TREASURY_PRIVATE_KEY when deploying to sonicBlaze.",
    );
  }
  const client = { client: { public: publicClient, wallet: deployer } };
  console.log(`Deploying to ${hre.network.name} as ${deployer.account.address}`);

  const token = await hre.viem.deployContract("OmertaToken", [
    deployer.account.address,
    deployer.account.address,
  ], client);
  console.log(`OmertaToken: ${token.address}`);

  const bank = await hre.viem.deployContract("Bank", [token.address], client);
  console.log(`Bank: ${bank.address}`);

  const bounty = await hre.viem.deployContract("Bounty", [
    token.address,
    deployer.account.address,
  ], client);
  console.log(`Bounty: ${bounty.address}`);

  const items = await hre.viem.deployContract("OmertaItems", [
    deployer.account.address,
    deployer.account.address,
  ], client);
  console.log(`OmertaItems: ${items.address}`);

  const auctionHouse = await hre.viem.deployContract("AuctionHouse", [
    token.address,
    items.address,
  ], client);
  console.log(`AuctionHouse: ${auctionHouse.address}`);

  const testament = await hre.viem.deployContract("Testament", [
    token.address,
    deployer.account.address,
  ], client);
  console.log(`Testament: ${testament.address}`);

  const trophy = await hre.viem.deployContract("SeasonTrophy", [
    deployer.account.address,
    deployer.account.address,
  ], client);
  console.log(`SeasonTrophy: ${trophy.address}`);

  const outPath = join(__dirname, "..", "..", "web", "src", "lib", "chain", "deployments.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: hre.network.name,
        chainId: hre.network.config.chainId ?? 31337,
        omertaToken: token.address,
        bank: bank.address,
        bounty: bounty.address,
        omertaItems: items.address,
        auctionHouse: auctionHouse.address,
        testament: testament.address,
        seasonTrophy: trophy.address,
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Addresses written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
