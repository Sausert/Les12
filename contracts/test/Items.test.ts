import { expect } from "chai";
import hre from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther } from "viem";

describe("OmertaItems, AuctionHouse & Testament", () => {
  async function deployFixture() {
    const [admin, treasury, seller, bidder, rival, heir] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("OmertaToken", [
      admin.account.address,
      treasury.account.address,
    ]);
    const items = await hre.viem.deployContract("OmertaItems", [
      admin.account.address,
      treasury.account.address,
    ]);
    const auctionHouse = await hre.viem.deployContract("AuctionHouse", [
      token.address,
      items.address,
    ]);
    const testament = await hre.viem.deployContract("Testament", [
      token.address,
      treasury.account.address,
    ]);
    return { token, items, auctionHouse, testament, admin, treasury, seller, bidder, rival, heir };
  }

  describe("items", () => {
    it("mints sequential token ids with type and uri, minter-only", async () => {
      const { items, treasury, seller } = await loadFixture(deployFixture);
      await items.write.mintItem([seller.account.address, 3n, "/nft/tommy_gun.json"], {
        account: treasury.account,
      });
      expect(await items.read.ownerOf([1n])).to.equal(getAddress(seller.account.address));
      expect(await items.read.itemTypeOf([1n])).to.equal(3n);
      expect(await items.read.tokenURI([1n])).to.equal("/nft/tommy_gun.json");

      await expect(
        items.write.mintItem([seller.account.address, 1n, "x"], { account: seller.account }),
      ).to.be.rejectedWith("AccessControlUnauthorizedAccount");
    });
  });

  describe("auction house", () => {
    async function auctionFixture() {
      const fixture = await deployFixture();
      const { token, items, auctionHouse, treasury, seller, bidder, rival } = fixture;
      await items.write.mintItem([seller.account.address, 1n, "/nft/revolver.json"], {
        account: treasury.account,
      });
      await items.write.approve([auctionHouse.address, 1n], { account: seller.account });
      await auctionHouse.write.createAuction([1n, parseEther("100"), 3600n], {
        account: seller.account,
      });
      for (const wallet of [bidder, rival]) {
        await token.write.mint([wallet.account.address, parseEther("1000")], {
          account: treasury.account,
        });
        await token.write.approve([auctionHouse.address, parseEther("1000")], {
          account: wallet.account,
        });
      }
      return fixture;
    }

    it("escrows the item, refunds outbid bidders and settles to the winner", async () => {
      const { token, items, auctionHouse, seller, bidder, rival } =
        await loadFixture(auctionFixture);
      expect(await items.read.ownerOf([1n])).to.equal(getAddress(auctionHouse.address));

      await auctionHouse.write.bid([1n, parseEther("100")], { account: bidder.account });
      await auctionHouse.write.bid([1n, parseEther("150")], { account: rival.account });
      // The first bidder got his 100 back on the spot.
      expect(await token.read.balanceOf([bidder.account.address])).to.equal(parseEther("1000"));

      await expect(
        auctionHouse.write.bid([1n, parseEther("150")], { account: bidder.account }),
      ).to.be.rejectedWith("BidTooLow");
      await expect(auctionHouse.write.settle([1n])).to.be.rejectedWith("AuctionNotEnded");

      await time.increase(3601);
      await expect(
        auctionHouse.write.bid([1n, parseEther("200")], { account: bidder.account }),
      ).to.be.rejectedWith("AuctionEnded");
      await auctionHouse.write.settle([1n]);

      expect(await items.read.ownerOf([1n])).to.equal(getAddress(rival.account.address));
      expect(await token.read.balanceOf([seller.account.address])).to.equal(parseEther("150"));
      await expect(auctionHouse.write.settle([1n])).to.be.rejectedWith("AlreadySettled");
    });

    it("returns the item unsold when nobody bids", async () => {
      const { items, auctionHouse, seller } = await loadFixture(auctionFixture);
      await time.increase(3601);
      await auctionHouse.write.settle([1n]);
      expect(await items.read.ownerOf([1n])).to.equal(getAddress(seller.account.address));
    });

    it("rejects bids below the start price", async () => {
      const { auctionHouse, bidder } = await loadFixture(auctionFixture);
      await expect(
        auctionHouse.write.bid([1n, parseEther("99")], { account: bidder.account }),
      ).to.be.rejectedWith("BidTooLow");
    });
  });

  describe("testament", () => {
    async function signDeathAttest(
      treasury: Awaited<ReturnType<typeof hre.viem.getWalletClients>>[number],
      testamentAddress: `0x${string}`,
      deceased: `0x${string}`,
      heir: `0x${string}`,
      nonce: bigint,
    ) {
      const chainId = await (await hre.viem.getPublicClient()).getChainId();
      return treasury.signTypedData({
        account: treasury.account,
        domain: {
          name: "SonicOmertaTestament",
          version: "1",
          chainId,
          verifyingContract: testamentAddress,
        },
        types: {
          DeathAttest: [
            { name: "deceased", type: "address" },
            { name: "heir", type: "address" },
            { name: "nonce", type: "uint256" },
          ],
        },
        primaryType: "DeathAttest",
        message: { deceased, heir, nonce },
      });
    }

    it("pays the heir 60%, burns 40% and refuses reuse or wrong heirs", async () => {
      const { token, testament, treasury, seller, bidder, heir } =
        await loadFixture(deployFixture);
      await token.write.mint([seller.account.address, parseEther("100")], {
        account: treasury.account,
      });
      await token.write.approve([testament.address, parseEther("100")], {
        account: seller.account,
      });
      await testament.write.nameHeir([heir.account.address], { account: seller.account });

      // Wrong heir in the attest is rejected before signature checking.
      const wrong = await signDeathAttest(
        treasury,
        testament.address,
        seller.account.address,
        bidder.account.address,
        1n,
      );
      await expect(
        testament.write.execute(
          [seller.account.address, bidder.account.address, 1n, wrong],
        ),
      ).to.be.rejectedWith("HeirMismatch");

      const signature = await signDeathAttest(
        treasury,
        testament.address,
        seller.account.address,
        heir.account.address,
        1n,
      );
      await testament.write.execute(
        [seller.account.address, heir.account.address, 1n, signature],
      );

      expect(await token.read.balanceOf([heir.account.address])).to.equal(parseEther("60"));
      expect(await token.read.balanceOf([seller.account.address])).to.equal(0n);
      expect(await token.read.totalSupply()).to.equal(parseEther("60"));

      await expect(
        testament.write.execute([seller.account.address, heir.account.address, 1n, signature]),
      ).to.be.rejectedWith("NonceUsed");
    });

    it("rejects execution without a named heir or forged attests", async () => {
      const { token, testament, treasury, seller, bidder, heir } =
        await loadFixture(deployFixture);
      await token.write.mint([seller.account.address, parseEther("10")], {
        account: treasury.account,
      });

      const signature = await signDeathAttest(
        treasury,
        testament.address,
        seller.account.address,
        heir.account.address,
        2n,
      );
      await expect(
        testament.write.execute([seller.account.address, heir.account.address, 2n, signature]),
      ).to.be.rejectedWith("NoHeir");

      await testament.write.nameHeir([heir.account.address], { account: seller.account });
      const forged = await signDeathAttest(
        bidder,
        testament.address,
        seller.account.address,
        heir.account.address,
        3n,
      );
      await expect(
        testament.write.execute([seller.account.address, heir.account.address, 3n, forged]),
      ).to.be.rejectedWith("InvalidAttestation");
    });
  });
});
