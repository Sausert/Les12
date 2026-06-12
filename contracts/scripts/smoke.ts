import hre from "hardhat";
import { defineChain, parseEther } from "viem";
import deployments from "../../web/src/lib/chain/deployments.json";

const sonicBlazeChain = defineChain({
  id: 14601,
  name: "Sonic Blaze Testnet",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.SONIC_BLAZE_RPC ?? "https://rpc.testnet.soniclabs.com"] },
  },
});

/**
 * Post-deploy smoke test: checks that every contract has code at its address,
 * mints 1 OMD from the treasury to itself and reads the balance back.
 *
 *   TREASURY_PRIVATE_KEY=0x… npx hardhat run scripts/smoke.ts --network sonicBlaze
 */
async function main() {
  const chainOverride = hre.network.config.chainId === 14601 ? { chain: sonicBlazeChain } : {};
  const [treasury] = await hre.viem.getWalletClients(chainOverride);
  if (!treasury) throw new Error("Set TREASURY_PRIVATE_KEY for this network.");
  const publicClient = await hre.viem.getPublicClient(chainOverride);
  const client = { client: { public: publicClient, wallet: treasury } };
  console.log(`Network: ${hre.network.name} · treasury: ${treasury.account.address}`);

  const gas = await publicClient.getBalance({ address: treasury.account.address });
  console.log(`Treasury gas: ${gas / 10n ** 18n} S (${gas} wei)`);
  if (gas === 0n) throw new Error("Treasury has no gas — visit https://testnet.soniclabs.com");

  const named: Record<string, string | null> = {
    omertaToken: deployments.omertaToken,
    bank: deployments.bank,
    bounty: (deployments as Record<string, unknown>).bounty as string | null,
    omertaItems: (deployments as Record<string, unknown>).omertaItems as string | null,
    auctionHouse: (deployments as Record<string, unknown>).auctionHouse as string | null,
    testament: (deployments as Record<string, unknown>).testament as string | null,
    seasonTrophy: (deployments as Record<string, unknown>).seasonTrophy as string | null,
  };
  for (const [name, address] of Object.entries(named)) {
    if (!address) throw new Error(`deployments.json mist ${name} — deploy eerst`);
    const code = await publicClient.getCode({ address: address as `0x${string}` });
    if (!code || code === "0x") throw new Error(`${name} heeft geen code op ${address}`);
    console.log(`✓ ${name.padEnd(13)} ${address}`);
  }

  const token = await hre.viem.getContractAt(
    "OmertaToken",
    named.omertaToken as `0x${string}`,
    client,
  );
  const before = await token.read.balanceOf([treasury.account.address]);
  const hash = await token.write.mint([treasury.account.address, parseEther("1")], {
    account: treasury.account,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  const after = await token.read.balanceOf([treasury.account.address]);
  if (after - before !== parseEther("1")) throw new Error("mint kwam niet aan");
  console.log(`✓ mint-roundtrip OK (tx ${hash})`);
  console.log("\nSMOKE TEST PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
