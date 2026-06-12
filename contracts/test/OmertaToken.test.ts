import { expect } from "chai";
import hre from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther } from "viem";

describe("OmertaToken & Bank", () => {
  async function deployFixture() {
    const [admin, treasury, player, other] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("OmertaToken", [
      admin.account.address,
      treasury.account.address,
    ]);
    const bank = await hre.viem.deployContract("Bank", [token.address]);
    const publicClient = await hre.viem.getPublicClient();
    return { token, bank, admin, treasury, player, other, publicClient };
  }

  describe("roles", () => {
    it("lets the treasury mint", async () => {
      const { token, treasury, player } = await loadFixture(deployFixture);
      await token.write.mint([player.account.address, parseEther("100")], {
        account: treasury.account,
      });
      expect(await token.read.balanceOf([player.account.address])).to.equal(
        parseEther("100"),
      );
    });

    it("rejects minting from non-minters", async () => {
      const { token, player } = await loadFixture(deployFixture);
      await expect(
        token.write.mint([player.account.address, 1n], { account: player.account }),
      ).to.be.rejectedWith("AccessControlUnauthorizedAccount");
    });

    it("lets the admin grant a new minter", async () => {
      const { token, admin, other, player } = await loadFixture(deployFixture);
      const minterRole = await token.read.MINTER_ROLE();
      await token.write.grantRole([minterRole, other.account.address], {
        account: admin.account,
      });
      await token.write.mint([player.account.address, 1n], { account: other.account });
      expect(await token.read.balanceOf([player.account.address])).to.equal(1n);
    });
  });

  describe("faucet", () => {
    it("pays out 1000 OMD and enforces the 24h cooldown", async () => {
      const { token, player } = await loadFixture(deployFixture);
      await token.write.faucet({ account: player.account });
      expect(await token.read.balanceOf([player.account.address])).to.equal(
        parseEther("1000"),
      );

      await expect(token.write.faucet({ account: player.account })).to.be.rejectedWith(
        "FaucetCooldownActive",
      );

      await time.increase(24 * 60 * 60 + 1);
      await token.write.faucet({ account: player.account });
      expect(await token.read.balanceOf([player.account.address])).to.equal(
        parseEther("2000"),
      );
    });
  });

  describe("bank deposits", () => {
    it("burns approved tokens and emits Deposited", async () => {
      const { token, bank, treasury, player, publicClient } =
        await loadFixture(deployFixture);
      await token.write.mint([player.account.address, parseEther("50")], {
        account: treasury.account,
      });
      await token.write.approve([bank.address, parseEther("50")], {
        account: player.account,
      });
      const hash = await bank.write.deposit([parseEther("50")], {
        account: player.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      expect(await token.read.balanceOf([player.account.address])).to.equal(0n);
      expect(await token.read.totalSupply()).to.equal(0n);

      const events = await bank.getEvents.Deposited();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.player).to.equal(getAddress(player.account.address));
      expect(events[0].args.amount).to.equal(parseEther("50"));
    });

    it("rejects zero-amount and unapproved deposits", async () => {
      const { token, bank, treasury, player } = await loadFixture(deployFixture);
      await expect(
        bank.write.deposit([0n], { account: player.account }),
      ).to.be.rejectedWith("ZeroAmount");

      await token.write.mint([player.account.address, parseEther("10")], {
        account: treasury.account,
      });
      await expect(
        bank.write.deposit([parseEther("10")], { account: player.account }),
      ).to.be.rejectedWith("ERC20InsufficientAllowance");
    });
  });
});
