import dotenv from 'dotenv';
import cors from 'cors';
import express from "express";
import http from "http";
import WebSocket from "ws";

import { arbitrum } from "./arbitrum.ts";
import { setupSolanaConnection } from "./solana.ts";
import { depositForBurn } from "./depositForBurn.ts";


dotenv.config();

interface Data {
    action: string;
    toAddress: string;
    amount: bigint
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({server});
const {swapUSDCToETH, transferETH, setupArbitrumConnection} = arbitrum();

// Middleware
app.use(express.json());

// WebSocket connection handler
wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", async (message) => {
        console.log("Received message:", message);
        try {
            const data = JSON.parse(message as string) as Data;
            if (data.action === "transferETH") {
                await handleETHTransfer(data, ws);
            } else {
                ws.send(JSON.stringify({status: "error", message: "Unknown action"}));
            }
        } catch (error) {
            if(error instanceof Error) {
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
            message: "Beginning USDC to ETH swap and transfer",
        })
    );

    try {
        ws.send(
            JSON.stringify({status: "swapping", message: "Swapping USDC to ETH"})
        );
        const swapTxHash = await swapUSDCToETH(amount);
        ws.send(
            JSON.stringify({
                status: "swapped",
                message: "USDC swapped to ETH",
                swapTxHash,
            })
        );

        ws.send(
            JSON.stringify({
                status: "transferring",
                message: "Transferring ETH to destination",
            })
        );
        const transferTxHash = await transferETH(toAddress, amount); // Note: The amount here will be different from the USDC amount
        ws.send(
            JSON.stringify({
                status: "complete",
                message: "ETH transfer completed",
                swapTxHash,
                transferTxHash,
            })
        );
    } catch (error) {
        if(error instanceof Error) {
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

app.use(cors({
    origin: 'http://localhost:9000'
}));

app.get("/", (req, res) => {
    res.send("CCTP Transfer Service is running");
});

app.post("/burn_deposit", async (req, res) => {
    await depositForBurn()
    res.json({message: 'Success'});
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    setupSolanaConnection();
    setupArbitrumConnection();
});
