import {ethers, JsonRpcProvider, Wallet} from "ethers";
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

let arbitrumProvider: JsonRpcProvider;
let arbitrumWallet: Wallet;

const INCH_API_URL = "https://api.1inch.dev/swap/v6.0/42161"; // Arbitrum
const INCH_API_KEY = process.env.INCH_API_KEY;
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC on Arbitrum
const ETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // ETH address for 1inch API

export const arbitrum = () => {
  const setupArbitrumConnection = () => {
    arbitrumProvider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    arbitrumWallet = new ethers.Wallet(
        process.env.ARBITRUM_SERVICE_WALLET_PRIVATE_KEY as string,
        arbitrumProvider
    );
    console.log("Arbitrum connection established");
  };

  const swapUSDCToETH = async (amountUSDC: bigint) => {
    if (!arbitrumWallet) {
      throw new Error("Arbitrum wallet not initialized");
    }

    const fromTokenAddress = USDC_ADDRESS;
    const toTokenAddress = ETH_ADDRESS;
    const fromAddress = arbitrumWallet.address;
    const amount = ethers.parseUnits(amountUSDC.toString(), 6); // USDC has 6 decimals

    const currentAllowance = await checkTokenAllowance(
        fromTokenAddress,
        fromAddress
    );

    if (currentAllowance < amount) {
      console.log("Insufficient allowance. Approving more tokens...");
      await approveToken(fromTokenAddress, amount);
    } else {
      console.log("Sufficient allowance detected.");
    }
    console.log("after checking allowance");

    const swapParams = new URLSearchParams({
      fromTokenAddress,
      toTokenAddress,
      amount: amount.toString(),
      fromAddress,
      slippage: '1',
      disableEstimate: 'false',
    }).toString();

    const url = `${INCH_API_URL}/swap?${swapParams}`;
    console.log("Requesting 1inch API:", url);

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${INCH_API_KEY}` },
      });

      const responseText = await response.text();
      console.log("1inch API response:", responseText);

      if (!response.ok) {
        throw new Error(
            `HTTP error! status: ${response.status}, body: ${responseText}`
        );
      }

      const swapData = JSON.parse(responseText);

      if (swapData.tx) {
        const tx = await arbitrumWallet.sendTransaction({
          from: swapData.tx.from,
          to: swapData.tx.to,
          data: swapData.tx.data,
          value: swapData.tx.value,
          gasPrice: swapData.tx.gasPrice,
          gasLimit: swapData.tx.gas,
        });

        const receipt = await tx.wait();
        console.log("Swap transaction confirmed:", receipt!.hash);
        return receipt!.hash;
      } else {
        throw new Error("Swap data does not contain transaction information");
      }
    } catch (error) {
      console.error("Error in swapUSDCToETH:", error);
      throw error;
    }
  };

  const transferETH = async (toAddress: string, amount: bigint) => {
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
  };

  const checkTokenAllowance = async (tokenAddress: string, walletAddress: string) => {
    const contract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
        ],
        arbitrumProvider
    );

    const currentAllowance = await contract.allowance(
        walletAddress,
        process.env.INCH_ROUTER_ADDRESS
    );

    console.log(
        `Current allowance for ${walletAddress} is: ${currentAllowance.toString()}`
    );

    return currentAllowance;
  };

  const approveToken = async (tokenAddress: string, amount: bigint) => {
    const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function approve(address spender, uint amount) returns (bool)"],
        arbitrumWallet
    );

    const tx = await tokenContract.approve(
        process.env.INCH_ROUTER_ADDRESS,
        amount
    );
    await tx.wait();
    console.log("Approval transaction hash:", tx.hash);
  };

  return {
    setupArbitrumConnection,
    swapUSDCToETH,
    transferETH
  };
};
