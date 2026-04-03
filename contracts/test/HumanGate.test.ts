import { expect } from "chai";
import { ethers } from "hardhat";

describe("HumanGate", () => {
  it("deploys with correct external nullifier hash", async () => {
    // Deploy a mock WorldID that always passes
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    expect(await gate.externalNullifierHash()).to.not.equal(0n);
  });

  it("verifies an agent and emits AgentVerified", async () => {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const [, agent] = await ethers.getSigners();
    const nullifierHash = 12345n;
    const proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] =
      [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    await expect(gate.verifyAgent(agent.address, 1n, nullifierHash, proof))
      .to.emit(gate, "AgentVerified")
      .withArgs(agent.address, nullifierHash);

    expect(await gate.isVerified(agent.address)).to.equal(true);
  });

  it("reverts on duplicate nullifier", async () => {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const [, agent] = await ethers.getSigners();
    const nullifierHash = 99n;
    const proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] =
      [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    await gate.verifyAgent(agent.address, 1n, nullifierHash, proof);

    await expect(gate.verifyAgent(agent.address, 1n, nullifierHash, proof))
      .to.be.revertedWithCustomError(gate, "AlreadyVerified");
  });
});
