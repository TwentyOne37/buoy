import dotenv from 'dotenv';
import cors from 'cors';
import express from "express";
import http from "http";
import WebSocket from "ws";

import {arbitrum} from "./arbitrum.ts";
import {setupSolanaConnection} from "./solana.ts";
import {depositForBurn} from "./depositForBurn.ts";

dotenv.config();

interface Data {
    action: string;
    toAddress: string;
    amount: bigint
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({server});
const {swapUSDCToWETH, unwrapWETH, transferETH, setupArbitrumConnection} = arbitrum();

// Middleware
app.use(express.json());

// WebSocket connection handler
wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", async (message) => {
        console.log("Received message:", message);
        try {
            const data = JSON.parse(message as string);
            if (data.action === "transferETH") {
                await handleETHTransfer(data, ws);
            } else {
                ws.send(JSON.stringify({status: "error", message: "Unknown action"}));
            }
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error processing message:", error);
                ws.send(JSON.stringify({status: "error", message: error.message}));
            }
        }
    });

    ws.on("close", () => {
        console.log("WebSocket connection closed");
    });
});

async function handleETHTransfer(data: Data, ws: WebSocket) {
    const {toAddress, amount} = data;
    ws.send(
        JSON.stringify({
            status: "starting",
            message: "Beginning USDC to ETH swap, unwrap, and transfer",
        })
    );

    try {
        // First, swap USDC to WETH
        ws.send(
            JSON.stringify({status: "swapping", message: "Swapping USDC to WETH"})
        );
        const swapResult = await swapUSDCToWETH(amount);
        console.log("Swap result received:", swapResult);

        if (
            !swapResult ||
            (!swapResult.transactionHash && !swapResult.wethAmount)
        ) {
            throw new Error("Swap failed or returned unexpected result");
        }

        const {transactionHash: swapTxHash, wethAmount} = swapResult;
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
        if (error instanceof Error) {
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
}

async function handleCrossChainTransfer(data: Data, ws: WebSocket) {
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

app.use(cors({
    origin: 'http://localhost:9000'
}));

// HTTP routes
app.get("/", (req, res) => {
    res.send("CCTP Transfer Service is running");
});



app.post("/burn_deposit", async (req, res) => {
    await depositForBurn()
    res.json({message: 'Success'});
})

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    setupSolanaConnection();
    setupArbitrumConnection();
});