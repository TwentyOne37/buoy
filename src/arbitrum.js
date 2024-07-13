const { ethers } = require("ethers");

let arbitrumProvider;

function setupArbitrumConnection() {
  arbitrumProvider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  console.log("Arbitrum connection established");
}

// Add other Arbitrum-related functions here

module.exports = {
  setupArbitrumConnection,
  // Export other functions as needed
};
