'use client';

import {PrivyProvider} from '@privy-io/react-auth';
import {defineChain} from 'viem';

const sepolia = defineChain({
  id: 11155111,
  name: 'Ethereum Sepolia',
  network: 'sepolia',
  nativeCurrency: {
    name: 'Sepolia ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com']},
    public: {http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com']},
  },
});

export default function Providers({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'your-privy-app-id'}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
          },
        },
        // Backstop's deployed Aqua, Aave and USDC contracts are on Ethereum
        // Sepolia. Privy must be configured for this same network to sign.
        defaultChain: sepolia,
        supportedChains: [sepolia],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
