require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { setupSolanaConnection } = require("./solana");
const {
  setupArbitrumConnection,
  swapUSDCToWETH,
  transferETH,
  unwrapWETH,
} = require("./arbitrum");
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  ws.on("message", async (message) => {
    console.log("Received message:", message);
    try {
      const data = JSON.parse(message);
      if (data.action === "transferETH") {
        await handleETHTransfer(data, ws);
      } else {
        ws.send(JSON.stringify({ status: "error", message: "Unknown action" }));
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(JSON.stringify({ status: "error", message: error.message }));
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });
});

async function handleETHTransfer(data, ws) {
  const { toAddress, amount } = data;
  ws.send(
    JSON.stringify({
      status: "starting",
      message: "Beginning USDC to ETH swap, unwrap, and transfer",
    })
  );

  try {
    // First, swap USDC to WETH
    ws.send(
      JSON.stringify({ status: "swapping", message: "Swapping USDC to WETH" })
    );
    const swapResult = await swapUSDCToWETH(amount);
    console.log("Swap result received:", swapResult);

    if (
      !swapResult ||
      (!swapResult.transactionHash && !swapResult.wethAmount)
    ) {
      throw new Error("Swap failed or returned unexpected result");
    }

    const { transactionHash: swapTxHash, wethAmount } = swapResult;
    ws.send(
      JSON.stringify({
        status: "swapped",
        message: `USDC swapped to ${wethAmount || "unknown amount of"} WETH`,
        swapTxHash: swapTxHash || "unknown",
      })
    );

    if (!wethAmount || parseFloat(wethAmount) === 0) {
      throw new Error("No WETH received from swap");
    }

    // Then, unwrap WETH to ETH
    ws.send(
      JSON.stringify({
        status: "unwrapping",
        message: "Unwrapping WETH to ETH",
      })
    );
    const unwrapTxHash = await unwrapWETH(wethAmount);
    ws.send(
      JSON.stringify({
        status: "unwrapped",
        message: "WETH unwrapped to ETH",
        unwrapTxHash,
      })
    );

    // Finally, transfer the ETH
    ws.send(
      JSON.stringify({
        status: "transferring",
        message: "Transferring ETH to destination",
      })
    );
    const transferTxHash = await transferETH(toAddress, wethAmount);
    ws.send(
      JSON.stringify({
        status: "complete",
        message: "ETH transfer completed",
        swapTxHash: swapTxHash || "unknown",
        unwrapTxHash,
        transferTxHash,
      })
    );
  } catch (error) {
    console.error("Error in handleETHTransfer:", error);
    ws.send(
      JSON.stringify({
        status: "error",
        message: error.message,
        details: error.stack,
      })
    );
  }
}

async function handleCrossChainTransfer(data, ws) {
  // Implement the cross-chain transfer logic here
  // This is where you'll call functions from solana.js and arbitrum.js
  // and send progress updates via WebSocket
  ws.send(
    JSON.stringify({
      status: "starting",
      message: "Beginning cross-chain transfer",
    })
  );

  // Placeholder for actual implementation
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        status: "complete",
        message: "Cross-chain transfer completed",
      })
    );
  }, 5000);
}

// HTTP routes
app.get("/", (req, res) => {
  res.send("CCTP Transfer Service is running");
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  setupSolanaConnection();
  setupArbitrumConnection();
});
