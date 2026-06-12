import hre from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Deploys OmertaToken + Bank. The deployer account (TREASURY_PRIVATE_KEY on
 * sonicBlaze) becomes both admin and minter, and the addresses are written to
 * web/src/lib/chain/deployments.json for the game server to pick up.
 */
async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set TREASURY_PRIVATE_KEY when deploying to sonicBlaze.",
    );
  }
  console.log(`Deploying to ${hre.network.name} as ${deployer.account.address}`);

  const token = await hre.viem.deployContract("OmertaToken", [
    deployer.account.address,
    deployer.account.address,
  ]);
  console.log(`OmertaToken: ${token.address}`);

  const bank = await hre.viem.deployContract("Bank", [token.address]);
  console.log(`Bank: ${bank.address}`);

  const bounty = await hre.viem.deployContract("Bounty", [
    token.address,
    deployer.account.address,
  ]);
  console.log(`Bounty: ${bounty.address}`);

  const items = await hre.viem.deployContract("OmertaItems", [
    deployer.account.address,
    deployer.account.address,
  ]);
  console.log(`OmertaItems: ${items.address}`);

  const auctionHouse = await hre.viem.deployContract("AuctionHouse", [
    token.address,
    items.address,
  ]);
  console.log(`AuctionHouse: ${auctionHouse.address}`);

  const testament = await hre.viem.deployContract("Testament", [
    token.address,
    deployer.account.address,
  ]);
  console.log(`Testament: ${testament.address}`);

  const trophy = await hre.viem.deployContract("SeasonTrophy", [
    deployer.account.address,
    deployer.account.address,
  ]);
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
