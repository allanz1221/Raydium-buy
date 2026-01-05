
import * as web3 from '@solana/web3.js';

const RAY_MINT_ADDRESS = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
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
    const mintPublicKey = new web3.PublicKey(RAY_MINT_ADDRESS);

    const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      mint: mintPublicKey,
    });

    if (accounts.value.length === 0) {
      return 0;
    }

    const balance = accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance || 0;
  } catch (err) {
    console.error('Error fetching RAY balance:', err);
    return 0;
  }
};
