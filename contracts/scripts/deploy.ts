import { ethers } from "hardhat";

async function main() {
  // World ID Router on World Chain Sepolia
  const WORLD_ID_ROUTER = "0x57f928158C3EE7CDad1e4D8642503c4D0201f611";

  const appId  = process.env.NEXT_PUBLIC_APP_ID ?? "app_xxxxx";
  const action = "verify-agent";

  const HumanGate = await ethers.getContractFactory("HumanGate");
  const gate = await HumanGate.deploy(WORLD_ID_ROUTER, appId, action);
  await gate.waitForDeployment();

  const address = await gate.getAddress();
  console.log(`HumanGate deployed to: ${address}`);
  console.log(`  worldIdRouter : ${WORLD_ID_ROUTER}`);
  console.log(`  appId         : ${appId}`);
  console.log(`  action        : ${action}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
