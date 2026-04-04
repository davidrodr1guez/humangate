import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "00".repeat(32);
const RPC = process.env.WORLD_CHAIN_RPC ?? "https://worldchain-mainnet.g.alchemy.com/public";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    worldChain: {
      url: RPC,
      chainId: 480,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;
