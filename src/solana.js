const { Connection } = require("@solana/web3.js");

let solanaConnection;

function setupSolanaConnection() {
  solanaConnection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");
  console.log("Solana connection established");
}

// Add other Solana-related functions here

module.exports = {
  setupSolanaConnection,
  // Export other functions as needed
};
