import { Connection } from "@solana/web3.js";

let solanaConnection;

export function setupSolanaConnection() {
  solanaConnection = new Connection(process.env.SOLANA_RPC_URL as string, "confirmed");
  console.log("Solana connection established");
}

// Export other functions as needed
