import { ethers } from "hardhat";

async function main() {
  // World ID Router on World Chain (mainnet)
  const WORLD_ID_ROUTER = "0x17B354dD2595411ff79041f930e491A4Df39A278";

  const appId  = process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx";
  const action = "verify-agent-v8";

  // 1. Deploy HumanGate
  const HumanGate = await ethers.getContractFactory("HumanGate");
  const gate = await HumanGate.deploy(WORLD_ID_ROUTER, appId, action);
  await gate.waitForDeployment();
  const gateAddr = await gate.getAddress();

  console.log(`HumanGate deployed to: ${gateAddr}`);
  console.log(`  worldIdRouter : ${WORLD_ID_ROUTER}`);
  console.log(`  appId         : ${appId}`);
  console.log(`  action        : ${action}`);

  // 2. Deploy HumanGateResolver (ENSIP-10 wildcard resolver)
  const Resolver = await ethers.getContractFactory("HumanGateResolver");
  const resolver = await Resolver.deploy(gateAddr);
  await resolver.waitForDeployment();
  const resolverAddr = await resolver.getAddress();

  console.log(`\nHumanGateResolver deployed to: ${resolverAddr}`);
  console.log(`  gate          : ${gateAddr}`);

  console.log(`\n--- Add to .env ---`);
  console.log(`HUMANGATE_CONTRACT_ADDRESS=${gateAddr}`);
  console.log(`HUMANGATE_RESOLVER_ADDRESS=${resolverAddr}`);
  console.log(`NEXT_PUBLIC_HUMANGATE_CONTRACT=${gateAddr}`);
  console.log(`NEXT_PUBLIC_RESOLVER_CONTRACT=${resolverAddr}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
