import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import fetch from "node-fetch";

let solanaConnection: Connection;

export function setupSolanaConnection() {
  solanaConnection = new Connection(
    process.env.SOLANA_RPC_URL as string,
    "confirmed"
  );
  console.log("Solana connection established");
}

function createKeypairFromPrivateKey(): Keypair {
  const privateKeyString = process.env
    .SOLANA_SERVICE_WALLET_PRIVATE_KEY as string;
  const privateKey = bs58.decode(privateKeyString);
  return Keypair.fromSecretKey(privateKey);
}

const serviceWallet = createKeypairFromPrivateKey();

const WIF_MINT = new PublicKey("EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

interface SwapTransactionResponse {
  swapTransaction: string;
}

export async function swapTokenToUSDC(
  amount: bigint,
  recipientPublicKey: string,
  ws: WebSocket
): Promise<string> {
  if (!solanaConnection) {
    throw new Error("Solana connection not established");
  }

  try {
    // Step 1: Fetch swap info
    const quoteResponse = await fetchSwapInfo(amount);

    // Step 2: Fetch the swap transaction
    const swapUser = serviceWallet; // Use the service wallet
    const recipientUSDCAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      new PublicKey(recipientPublicKey),
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const { swapTransaction } = await fetchSwapTransaction(
      swapUser,
      recipientUSDCAccount,
      quoteResponse
    );

    ws.send(
      JSON.stringify({
        status: "progress",
        message: "Swap transaction created",
      })
    );

    // Step 3: Send the transaction to the Solana blockchain
    const signature = await sendTransaction(swapTransaction, swapUser);

    ws.send(
      JSON.stringify({
        status: "complete",
        message: `Swap completed. Transaction signature: ${signature}`,
      })
    );

    return signature;
  } catch (error) {
    console.error("Error in swapTokenToUSDC:", error);
    ws.send(
      JSON.stringify({
        status: "error",
        message: `Swap failed: ${error.message}`,
      })
    );
    throw error;
  }
}

async function fetchSwapInfo(amount: bigint) {
  const response = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${WIF_MINT.toBase58()}&outputMint=${USDC_MINT.toBase58()}&amount=${amount.toString()}&swapMode=ExactIn&slippageBps=50`
  );
  return await response.json();
}

async function fetchSwapTransaction(
  swapUser: Keypair,
  recipientUSDCAccount: PublicKey,
  quoteResponse: any
) {
  const requestBody = {
    quoteResponse,
    userPublicKey: swapUser.publicKey.toBase58(),
    wrapAndUnwrapSol: true,
    destinationTokenAccount: recipientUSDCAccount.toBase58(),
    dynamicComputeUnitLimit: true,
  };

  const response = await fetch("https://quote-api.jup.ag/v6/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  return await response.json();
}

async function sendTransaction(
  swapTransaction: string,
  swapUser: Keypair
): Promise<string> {
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(swapTransaction, "base64")
  );

  transaction.sign([swapUser]);

  const rawTransaction = transaction.serialize();

  const signature = await solanaConnection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 2,
  });

  await solanaConnection.confirmTransaction(signature);

  return signature;
}

export {};
