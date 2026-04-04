import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";

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
  async function deployFixture() {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const Resolver = await ethers.getContractFactory("HumanGateResolver");
    const resolver = await Resolver.deploy(await gate.getAddress());

    const [owner, agent] = await ethers.getSigners();
    const proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] =
      [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    return { gate, resolver, owner, agent, proof };
  }

  it("registers a verified agent and resolves its ENS name", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 111n, proof);
    await expect(resolver.registerAgent(agent.address))
      .to.emit(resolver, "AgentNameRegistered");

    const label = agent.address.toLowerCase();
    const labelhash = ethers.keccak256(ethers.toUtf8Bytes(label));
    expect(await resolver.names(labelhash)).to.equal(agent.address);
  });

  it("reverts registerAgent for unverified agent", async () => {
    const { resolver, agent } = await deployFixture();

    await expect(resolver.registerAgent(agent.address))
      .to.be.revertedWith("Agent not verified");
  });

  it("supports ExtendedResolver and ITextResolver interfaces (ENSIP-10)", async () => {
    const { resolver } = await deployFixture();

    expect(await resolver.supportsInterface("0x9061b923")).to.equal(true); // ExtendedResolver
    expect(await resolver.supportsInterface("0x59d1d43c")).to.equal(true); // ITextResolver
    expect(await resolver.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC-165
  });

  it("sets default text records on registration", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 222n, proof);
    await resolver.registerAgent(agent.address);

    expect(await resolver.text(agent.address, "humangate.verified")).to.equal("true");
    expect(await resolver.text(agent.address, "humangate.chain")).to.equal("480");
    expect(await resolver.text(agent.address, "humangate.contract"))
      .to.equal((await gate.getAddress()).toLowerCase());
    expect(await resolver.text(agent.address, "description"))
      .to.include("Human-backed AI agent");
  });

  it("stores verifiedAt timestamp on registration", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 333n, proof);
    await resolver.registerAgent(agent.address);

    const verifiedAt = await resolver.verifiedAt(agent.address);
    expect(verifiedAt).to.be.greaterThan(0n);

    const textTimestamp = await resolver.text(agent.address, "humangate.verifiedAt");
    expect(textTimestamp).to.equal(verifiedAt.toString());
  });

  it("allows setting custom text records for verified agents", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 444n, proof);
    await resolver.registerAgent(agent.address);

    await expect(resolver.setText(agent.address, "url", "https://myagent.ai"))
      .to.emit(resolver, "TextRecordSet")
      .withArgs(agent.address, "url", "https://myagent.ai");

    expect(await resolver.text(agent.address, "url")).to.equal("https://myagent.ai");
  });

  it("reverts setText for unverified agent", async () => {
    const { resolver, agent } = await deployFixture();

    await expect(resolver.setText(agent.address, "url", "https://test.com"))
      .to.be.revertedWith("Agent not verified");
  });

  it("resolves text records via ENSIP-10 wildcard", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 555n, proof);
    await resolver.registerAgent(agent.address);

    // Build DNS-encoded name for the agent
    const label = agent.address.toLowerCase();
    const labelBytes = ethers.toUtf8Bytes(label);
    const parentLabel = ethers.toUtf8Bytes("humanbacked");
    const tldLabel = ethers.toUtf8Bytes("eth");

    // DNS encoding: [len][label][len][parent][len][tld][0]
    const dnsName = ethers.concat([
      new Uint8Array([labelBytes.length]),
      labelBytes,
      new Uint8Array([parentLabel.length]),
      parentLabel,
      new Uint8Array([tldLabel.length]),
      tldLabel,
      new Uint8Array([0]),
    ]);

    // Encode text(bytes32,string) call
    const node = ethers.namehash(label + ".humanbacked.eth");
    const textCalldata = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "string"],
      [node, "humangate.verified"]
    );
    const textSelector = "0x59d1d43c";
    const fullCalldata = ethers.concat([textSelector, textCalldata]);

    const result = await resolver.resolve(dnsName, fullCalldata);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], result);
    expect(decoded[0]).to.equal("true");
  });
});

describe("ProtectedFaucet", () => {
  async function deployFaucetFixture() {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const Faucet = await ethers.getContractFactory("ProtectedFaucet");
    const faucet = await Faucet.deploy(await gate.getAddress());

    const [owner, agent] = await ethers.getSigners();
    const proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] =
      [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    // Fund the faucet
    await owner.sendTransaction({ to: await faucet.getAddress(), value: parseEther("1") });

    return { gate, faucet, owner, agent, proof };
  }

  it("rejects unverified agents", async () => {
    const { faucet, agent } = await deployFaucetFixture();

    await expect(faucet.connect(agent).claim())
      .to.be.revertedWith("Not human-backed");
  });

  it("lets verified agents claim", async () => {
    const { gate, faucet, agent, proof } = await deployFaucetFixture();

    await gate.verifyAgent(agent.address, 1n, 777n, proof);

    await expect(faucet.connect(agent).claim())
      .to.emit(faucet, "Claimed")
      .withArgs(agent.address, parseEther("0.001"));
  });

  it("prevents double claims", async () => {
    const { gate, faucet, agent, proof } = await deployFaucetFixture();

    await gate.verifyAgent(agent.address, 1n, 888n, proof);
    await faucet.connect(agent).claim();

    await expect(faucet.connect(agent).claim())
      .to.be.revertedWith("Already claimed");
  });
});
