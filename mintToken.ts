import dotenv from 'dotenv';
import Web3 from 'web3';

dotenv.config();
import messageTransmitterAbi from './abis/cctp/MessageTransmitter.json' assert { type: 'json' };

const waitForTransaction = async(web3: Web3, txHash: string) => {
    let transactionReceipt = await web3.eth.getTransactionReceipt(txHash);
    while(transactionReceipt != null && !transactionReceipt.status) {
        transactionReceipt = await web3.eth.getTransactionReceipt(txHash);
        await new Promise(r => setTimeout(r, 4000));
    }
    return transactionReceipt;
}

export const mintToken = async(attestationSignature: string, messageBytes: string) => {
    const web3 = new Web3(process.env.ETH_TESTNET_RPC as string);
    console.log('Priv key: ', process.env.ARBITRUM_SERVICE_WALLET_PRIVATE_KEY)
    const arbSigner = web3.eth.accounts.privateKeyToAccount(process.env.ARBITRUM_SERVICE_WALLET_PRIVATE_KEY as string);
    web3.eth.accounts.wallet.add(arbSigner);

    const ARB_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS = process.env.ARB_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS;
    const arbMessageTransmitterContract = new web3.eth.Contract(messageTransmitterAbi, ARB_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS, { from: arbSigner.address });

    web3.setProvider(process.env.ARBITRUM_RPC_URL as string);
    const receiveTxGas = await arbMessageTransmitterContract.methods.receiveMessage(messageBytes, attestationSignature).estimateGas();
    const receiveTx = await arbMessageTransmitterContract.methods.receiveMessage(messageBytes, attestationSignature).send({gas: receiveTxGas.toString()});
    const receiveTxReceipt = await waitForTransaction(web3, receiveTx.transactionHash);
    console.log('ReceiveTxReceipt: ', receiveTxReceipt)
};
