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

  it("registers via cloud-verified path (registerVerified)", async () => {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const [owner, agent] = await ethers.getSigners();

    await expect(gate.registerVerified(agent.address, 42n))
      .to.emit(gate, "AgentVerified")
      .withArgs(agent.address, 42n);

    expect(await gate.isVerified(agent.address)).to.equal(true);
  });

  it("rejects registerVerified from non-operator", async () => {
    const Mock = await ethers.getContractFactory("MockWorldID");
    const mock = await Mock.deploy();

    const HumanGate = await ethers.getContractFactory("HumanGate");
    const gate = await HumanGate.deploy(await mock.getAddress(), "app_test", "verify-agent");

    const [, agent] = await ethers.getSigners();

    await expect(gate.connect(agent).registerVerified(agent.address, 42n))
      .to.be.revertedWithCustomError(gate, "NotOperator");
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

  it("registers a verified agent with human-readable name", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 111n, proof);
    await expect(resolver.registerAgent(agent.address, "mybot"))
      .to.emit(resolver, "AgentNameRegistered")
      .withArgs(agent.address, "mybot", "mybot.humanbacked.eth", await resolver.verifiedAt(agent.address).then(() => ethers.provider.getBlock("latest").then(b => b!.timestamp)));

    const labelhash = ethers.keccak256(ethers.toUtf8Bytes("mybot"));
    expect(await resolver.names(labelhash)).to.equal(agent.address);
    expect(await resolver.labels(agent.address)).to.equal("mybot");
    expect(await resolver.ensNameOf(agent.address)).to.equal("mybot.humanbacked.eth");
  });

  it("reverts registerAgent for unverified agent", async () => {
    const { resolver, agent } = await deployFixture();

    await expect(resolver.registerAgent(agent.address, "mybot"))
      .to.be.revertedWith("Agent not verified");
  });

  it("reverts on duplicate label", async () => {
    const { gate, resolver, owner, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 111n, proof);
    await resolver.registerAgent(agent.address, "mybot");

    // Verify owner too
    await gate.verifyAgent(owner.address, 1n, 222n, proof);
    await expect(resolver.registerAgent(owner.address, "mybot"))
      .to.be.revertedWithCustomError(resolver, "LabelTaken");
  });

  it("reverts on empty label", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 111n, proof);
    await expect(resolver.registerAgent(agent.address, ""))
      .to.be.revertedWithCustomError(resolver, "EmptyLabel");
  });

  it("supports ExtendedResolver and ITextResolver interfaces (ENSIP-10)", async () => {
    const { resolver } = await deployFixture();

    expect(await resolver.supportsInterface("0x9061b923")).to.equal(true);
    expect(await resolver.supportsInterface("0x59d1d43c")).to.equal(true);
    expect(await resolver.supportsInterface("0x01ffc9a7")).to.equal(true);
  });

  it("sets default text records including label", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 222n, proof);
    await resolver.registerAgent(agent.address, "trader-bot");

    expect(await resolver.text(agent.address, "humangate.verified")).to.equal("true");
    expect(await resolver.text(agent.address, "humangate.chain")).to.equal("480");
    expect(await resolver.text(agent.address, "humangate.label")).to.equal("trader-bot");
    expect(await resolver.text(agent.address, "description"))
      .to.include("trader-bot");
  });

  it("allows setting custom text records", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 444n, proof);
    await resolver.registerAgent(agent.address, "mybot");

    await expect(resolver.setText(agent.address, "url", "https://myagent.ai"))
      .to.emit(resolver, "TextRecordSet");

    expect(await resolver.text(agent.address, "url")).to.equal("https://myagent.ai");
  });

  it("resolves human-readable names via ENSIP-10 wildcard", async () => {
    const { gate, resolver, agent, proof } = await deployFixture();

    await gate.verifyAgent(agent.address, 1n, 555n, proof);
    await resolver.registerAgent(agent.address, "mybot");

    // Build DNS-encoded name for "mybot.humanbacked.eth"
    const label = "mybot";
    const labelBytes = ethers.toUtf8Bytes(label);
    const parentLabel = ethers.toUtf8Bytes("humanbacked");
    const tldLabel = ethers.toUtf8Bytes("eth");

    const dnsName = ethers.concat([
      new Uint8Array([labelBytes.length]),
      labelBytes,
      new Uint8Array([parentLabel.length]),
      parentLabel,
      new Uint8Array([tldLabel.length]),
      tldLabel,
      new Uint8Array([0]),
    ]);

    // addr(bytes32) resolution
    const addrSelector = "0x3b3b57de";
    const node = ethers.namehash("mybot.humanbacked.eth");
    const addrCalldata = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [node]);
    const addrResult = await resolver.resolve(dnsName, ethers.concat([addrSelector, addrCalldata]));
    const decodedAddr = ethers.AbiCoder.defaultAbiCoder().decode(["address"], addrResult);
    expect(decodedAddr[0]).to.equal(agent.address);

    // text(bytes32,string) resolution
    const textSelector = "0x59d1d43c";
    const textCalldata = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "string"],
      [node, "humangate.verified"]
    );
    const textResult = await resolver.resolve(dnsName, ethers.concat([textSelector, textCalldata]));
    const decodedText = ethers.AbiCoder.defaultAbiCoder().decode(["string"], textResult);
    expect(decodedText[0]).to.equal("true");
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
