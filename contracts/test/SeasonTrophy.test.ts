import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";

describe("SeasonTrophy", () => {
  async function deployFixture() {
    const [admin, treasury, champion, other] = await hre.viem.getWalletClients();
    const trophy = await hre.viem.deployContract("SeasonTrophy", [
      admin.account.address,
      treasury.account.address,
    ]);
    return { trophy, admin, treasury, champion, other };
  }

  it("mints trophies with season and position, minter-only", async () => {
    const { trophy, treasury, champion, other } = await loadFixture(deployFixture);
    await trophy.write.mintTrophy([champion.account.address, 1, 1], {
      account: treasury.account,
    });
    expect(await trophy.read.ownerOf([1n])).to.equal(getAddress(champion.account.address));
    const standing = await trophy.read.standings([1n]);
    expect(standing[0]).to.equal(1); // season
    expect(standing[1]).to.equal(1); // position

    await expect(
      trophy.write.mintTrophy([other.account.address, 1, 2], { account: other.account }),
    ).to.be.rejectedWith("AccessControlUnauthorizedAccount");
  });

  it("is soulbound: transfers always revert", async () => {
    const { trophy, treasury, champion, other } = await loadFixture(deployFixture);
    await trophy.write.mintTrophy([champion.account.address, 1, 1], {
      account: treasury.account,
    });
    await expect(
      trophy.write.transferFrom(
        [champion.account.address, other.account.address, 1n],
        { account: champion.account },
      ),
    ).to.be.rejectedWith("Soulbound");

    // Even with an approval in place the transfer stays blocked.
    await trophy.write.approve([other.account.address, 1n], { account: champion.account });
    await expect(
      trophy.write.transferFrom(
        [champion.account.address, other.account.address, 1n],
        { account: other.account },
      ),
    ).to.be.rejectedWith("Soulbound");
  });
});
