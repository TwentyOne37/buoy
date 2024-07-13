const { ethers } = require("ethers");
require("dotenv").config();

let arbitrumProvider;
let arbitrumWallet;

function setupArbitrumConnection() {
  arbitrumProvider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  arbitrumWallet = new ethers.Wallet(
    process.env.ARBITRUM_SERVICE_WALLET_PRIVATE_KEY,
    arbitrumProvider
  );
  console.log("Arbitrum Sepolia connection established");
}

async function transferETH(toAddress, amount) {
  if (!arbitrumWallet) {
    throw new Error("Arbitrum wallet not initialized");
  }

  const amountWei = ethers.parseEther(amount.toString());

  const tx = await arbitrumWallet.sendTransaction({
    to: toAddress,
    value: amountWei,
  });

  console.log(`Transaction hash: ${tx.hash}`);
  await tx.wait();
  console.log("Transaction confirmed");

  return tx.hash;
}

module.exports = {
  setupArbitrumConnection,
  transferETH,
};
