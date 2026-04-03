import { expect } from "chai";
import { ethers } from "hardhat";

describe("HumanGate", () => {
  it("deploys with correct external nullifier hash", async () => {
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

describe("HumanGateResolver", () => {
  it("registers a verified agent and resolves its ENS name", async () => {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const Resolver = await ethers.getContractFactory("HumanGateResolver");
    const resolver = await Resolver.deploy(await gate.getAddress());

    const [, agent] = await ethers.getSigners();
    const proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] =
      [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    // Verify the agent first
    await gate.verifyAgent(agent.address, 1n, 111n, proof);

    // Register ENS name
    await expect(resolver.registerAgent(agent.address))
      .to.emit(resolver, "AgentNameRegistered");

    // Check labelhash mapping is set
    const label = agent.address.toLowerCase();
    const labelhash = ethers.keccak256(ethers.toUtf8Bytes(label));
    expect(await resolver.names(labelhash)).to.equal(agent.address);
  });

  it("reverts registerAgent for unverified agent", async () => {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const Resolver = await ethers.getContractFactory("HumanGateResolver");
    const resolver = await Resolver.deploy(await gate.getAddress());

    const [, agent] = await ethers.getSigners();

    await expect(resolver.registerAgent(agent.address))
      .to.be.revertedWith("Agent not verified");
  });

  it("supports ExtendedResolver interface (ENSIP-10)", async () => {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const Resolver = await ethers.getContractFactory("HumanGateResolver");
    const resolver = await Resolver.deploy(await gate.getAddress());

    // ExtendedResolver interface ID
    expect(await resolver.supportsInterface("0x9061b923")).to.equal(true);
    // ERC-165
    expect(await resolver.supportsInterface("0x01ffc9a7")).to.equal(true);
  });
});
