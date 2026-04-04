import { ethers } from "hardhat";

async function main() {
  const gateAddr = process.env.HUMANGATE_CONTRACT_ADDRESS;
  if (!gateAddr) throw new Error("Set HUMANGATE_CONTRACT_ADDRESS");

  const Resolver = await ethers.getContractFactory("HumanGateResolver");
  const resolver = await Resolver.deploy(gateAddr);
  await resolver.waitForDeployment();
  const resolverAddr = await resolver.getAddress();

  console.log(`HumanGateResolver v2 deployed to: ${resolverAddr}`);
  console.log(`  gate: ${gateAddr}`);
  console.log(`\nUpdate .env:`);
  console.log(`HUMANGATE_RESOLVER_ADDRESS=${resolverAddr}`);
  console.log(`NEXT_PUBLIC_RESOLVER_CONTRACT=${resolverAddr}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
