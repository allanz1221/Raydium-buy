
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';

const RAY_MINT = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

export const connectWallet = async () => {
  const isPhantomInstalled = (window as any).solana && (window as any).solana.isPhantom;
  if (!isPhantomInstalled) {
    window.open('https://phantom.app/', '_blank');
    throw new Error('Por favor instala Phantom Wallet');
  }
  try {
    const response = await (window as any).solana.connect();
    return response.publicKey.toString();
  } catch (err) {
    console.error('Wallet connection error:', err);
    throw err;
  }
};

export const fetchRayBalance = async (walletAddress: string): Promise<number> => {
  try {
    const connection = new web3.Connection(RPC_ENDPOINT);
    const publicKey = new web3.PublicKey(walletAddress);
    const mintPublicKey = new web3.PublicKey(RAY_MINT);
    const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: mintPublicKey });
    if (accounts.value.length === 0) return 0;
    return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
  } catch (err) {
    console.error('Error fetching RAY balance:', err);
    return 0;
  }
};

export const executeSwap = async (
  privateKey: string,
  type: 'BUY' | 'SELL',
  amount: number
): Promise<string> => {
  try {
    const connection = new web3.Connection(RPC_ENDPOINT);
    const decodedKey = bs58.decode(privateKey);
    const keypair = web3.Keypair.fromSecretKey(decodedKey);
    
    const inputMint = type === 'BUY' ? SOL_MINT : RAY_MINT;
    const outputMint = type === 'BUY' ? RAY_MINT : SOL_MINT;
    
    // 1. Obtener cotización de Jupiter
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${Math.floor(amount * 1e9)}&slippageBps=100`
    );
    const quoteData = await quoteResponse.json();
    
    if (!quoteData || quoteData.error) throw new Error('No se pudo obtener cotización de Jupiter');

    // 2. Obtener transacción de swap
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: keypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
      })
    });
    const { swapTransaction } = await swapResponse.json();

    // 3. Firmar y enviar
    // Fix: Use browser-native Uint8Array conversion for base64 to avoid Buffer dependency
    const transactionBuf = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
    const transaction = web3.VersionedTransaction.deserialize(transactionBuf);
    transaction.sign([keypair]);
    
    const txid = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      maxRetries: 2
    });

    return txid;
  } catch (error) {
    console.error('Swap execution error:', error);
    throw error;
  }
};
