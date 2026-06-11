import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther } from "viem";

describe("Bounty", () => {
  async function deployFixture() {
    const [admin, treasury, placer, killer, target] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("OmertaToken", [
      admin.account.address,
      treasury.account.address,
    ]);
    const bounty = await hre.viem.deployContract("Bounty", [
      token.address,
      treasury.account.address,
    ]);
    const publicClient = await hre.viem.getPublicClient();

    // Give the placer some OMD and approve the escrow.
    await token.write.mint([placer.account.address, parseEther("500")], {
      account: treasury.account,
    });
    await token.write.approve([bounty.address, parseEther("500")], {
      account: placer.account,
    });

    return { token, bounty, treasury, placer, killer, target, publicClient };
  }

  async function signAttest(
    treasury: Awaited<ReturnType<typeof hre.viem.getWalletClients>>[number],
    bountyAddress: `0x${string}`,
    target: `0x${string}`,
    killer: `0x${string}`,
    nonce: bigint,
  ) {
    const chainId = await (await hre.viem.getPublicClient()).getChainId();
    return treasury.signTypedData({
      account: treasury.account,
      domain: {
        name: "SonicOmertaBounty",
        version: "1",
        chainId,
        verifyingContract: bountyAddress,
      },
      types: {
        KillAttest: [
          { name: "target", type: "address" },
          { name: "killer", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "KillAttest",
      message: { target, killer, nonce },
    });
  }

  it("funds a pot and pays it out on a valid attestation", async () => {
    const { token, bounty, treasury, placer, killer, target } =
      await loadFixture(deployFixture);

    await bounty.write.fund([target.account.address, parseEther("200")], {
      account: placer.account,
    });
    await bounty.write.fund([target.account.address, parseEther("100")], {
      account: placer.account,
    });
    expect(await bounty.read.pots([target.account.address])).to.equal(parseEther("300"));

    const signature = await signAttest(
      treasury,
      bounty.address,
      target.account.address,
      killer.account.address,
      1n,
    );
    await bounty.write.claim(
      [target.account.address, killer.account.address, 1n, signature],
      { account: killer.account },
    );

    expect(await token.read.balanceOf([killer.account.address])).to.equal(parseEther("300"));
    expect(await bounty.read.pots([target.account.address])).to.equal(0n);

    const events = await bounty.getEvents.Claimed();
    expect(events[0].args.killer).to.equal(getAddress(killer.account.address));
  });

  it("rejects reused nonces and forged attestations", async () => {
    const { bounty, treasury, placer, killer, target } = await loadFixture(deployFixture);
    await bounty.write.fund([target.account.address, parseEther("50")], {
      account: placer.account,
    });

    // Forged: signed by someone other than the attestor.
    const forged = await signAttest(
      placer,
      bounty.address,
      target.account.address,
      killer.account.address,
      7n,
    );
    await expect(
      bounty.write.claim([target.account.address, killer.account.address, 7n, forged], {
        account: killer.account,
      }),
    ).to.be.rejectedWith("InvalidAttestation");

    const valid = await signAttest(
      treasury,
      bounty.address,
      target.account.address,
      killer.account.address,
      7n,
    );
    await bounty.write.claim(
      [target.account.address, killer.account.address, 7n, valid],
      { account: killer.account },
    );

    // Refund the pot and try the same nonce again.
    await bounty.write.fund([target.account.address, parseEther("10")], {
      account: placer.account,
    });
    await expect(
      bounty.write.claim([target.account.address, killer.account.address, 7n, valid], {
        account: killer.account,
      }),
    ).to.be.rejectedWith("NonceUsed");
  });

  it("rejects claims on empty pots and zero funding", async () => {
    const { bounty, treasury, placer, killer, target } = await loadFixture(deployFixture);

    await expect(
      bounty.write.fund([target.account.address, 0n], { account: placer.account }),
    ).to.be.rejectedWith("ZeroAmount");

    const signature = await signAttest(
      treasury,
      bounty.address,
      target.account.address,
      killer.account.address,
      2n,
    );
    await expect(
      bounty.write.claim([target.account.address, killer.account.address, 2n, signature], {
        account: killer.account,
      }),
    ).to.be.rejectedWith("EmptyPot");
  });
});
