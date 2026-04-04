import { ethers } from "hardhat";

async function main() {
  const gateAddr = process.env.HUMANGATE_CONTRACT_ADDRESS;
  if (!gateAddr) throw new Error("Set HUMANGATE_CONTRACT_ADDRESS");

  const Faucet = await ethers.getContractFactory("ProtectedFaucet");
  const faucet = await Faucet.deploy(gateAddr);
  await faucet.waitForDeployment();
  const faucetAddr = await faucet.getAddress();

  console.log(`ProtectedFaucet deployed to: ${faucetAddr}`);
  console.log(`  gate: ${gateAddr}`);
  console.log(`\nFund it with:`);
  console.log(`  cast send ${faucetAddr} --value 0.005ether --rpc-url $WORLD_CHAIN_RPC --private-key $PRIVATE_KEY`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
