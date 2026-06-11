import { HardhatUserConfig, subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-toolbox-viem";

const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;

// Use the npm-installed solc-js compiler instead of downloading binaries
// (binaries.soliditylang.org is not reachable from this environment).
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: { solcVersion: string }, _hre, runSuper) => {
  if (args.solcVersion === "0.8.28") {
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: args.solcVersion,
      longVersion: "0.8.28",
    };
  }
  return runSuper(args);
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    sonicBlaze: {
      url: process.env.SONIC_BLAZE_RPC ?? "https://rpc.blaze.soniclabs.com",
      chainId: 57054,
      accounts: TREASURY_PRIVATE_KEY ? [TREASURY_PRIVATE_KEY] : [],
    },
  },
};

export default config;
