'use client';

import {usePrivy, useWallets, useSendTransaction, useSigners} from '@privy-io/react-auth';
import {useState, useEffect, useCallback} from 'react';

const PRIVY_AUTH_KEY_ID = process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID || '';
const PRIVY_POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_POLICY_ID || '';
const BACKSTOP_APP_ADDRESS = process.env.NEXT_PUBLIC_BACKSTOP_APP_ADDRESS || '0xc258e902262e6110b2dd0d267a6b2ab2e470b539';
const ALLOWED_ADDRESS = process.env.NEXT_PUBLIC_ALLOWED_ADDRESS || '';
const AQUA_REGISTRY = process.env.NEXT_PUBLIC_AQUA_REGISTRY_ADDRESS || '0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '';
const WETH_ADDRESS = process.env.NEXT_PUBLIC_WETH_ADDRESS || '';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111');
const QUOTE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_QUOTE_REGISTRY_ADDRESS || '0xe39e8eC1e77bc9F9E36e552105362F9D5BEe0F95';

// bytes4(keccak256("ship(address,bytes,address[],uint256[])"))
const AQUA_SHIP_SELECTOR = '0xf50b870f';

const encodeAquaShip = (app: string, strategy: string, tokens: string[], amounts: bigint[]): string => {
  const selector = AQUA_SHIP_SELECTOR;
  const paddedAddress = (addr: string) => addr.slice(2).padStart(64, '0');

  const strategyHex = strategy.replace(/^0x/, '');
  const strategyLen = strategyHex.length / 2;
  const strategyPaddedLen = strategyLen.toString(16).padStart(64, '0');

  const tokensLen = tokens.length.toString(16).padStart(64, '0');
  const tokensPadded = tokens.map(paddedAddress).join('');

  const amountsLen = amounts.length.toString(16).padStart(64, '0');
  const amountsPadded = amounts.map(n => n.toString(16).padStart(64, '0')).join('');

  const headSize = 4 * 32;
  const strategyDataEnd = headSize + 32 + strategyLen;
  const tokensOffset = (strategyDataEnd + 31) & ~31;
  const tokensDataEnd = tokensOffset + 32 + tokens.length * 32;
  const amountsOffset = (tokensDataEnd + 31) & ~31;

  const strategyOffsetHex = headSize.toString(16).padStart(64, '0');
  const tokensOffsetHex = tokensOffset.toString(16).padStart(64, '0');
  const amountsOffsetHex = amountsOffset.toString(16).padStart(64, '0');

  return (
    selector +
    paddedAddress(app) +
    strategyOffsetHex +
    tokensOffsetHex +
    amountsOffsetHex +
    strategyPaddedLen +
    strategyHex +
    tokensLen +
    tokensPadded +
    amountsLen +
    amountsPadded
  );
};

type LogEntry = { time: string; message: string; type: 'info' | 'success' | 'error' | 'policy' };
type Hex = `0x${string}`;

interface Strategy {
  maker: string;
  tokenIn: string;
  tokenOut: string;
  maxTrade: string;
  minDiscountBps: string;
  maxDiscountBps: string;
  expiry: string;
  salt: string;
}

interface Quote {
  quoteId: string;
  price: string;
  size: string;
  expiry: string;
  execute: boolean;
}

interface ExecutionResult {
  txHash: string;
  timestamp: string;
  usdcPulled: string;
  wethPushed: string;
  makerUsdcBefore: string;
  makerUsdcAfter: string;
  makerWethBefore: string;
  makerWethAfter: string;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export default function Home() {
  const {ready, authenticated, login, logout, user} = usePrivy();
  const {wallets} = useWallets();
  const {sendTransaction} = useSendTransaction();
  const {addSigners} = useSigners();

  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  const [signerAdded, setSignerAdded] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [addingSigner, setAddingSigner] = useState(false);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Strategy state
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [strategyHash, setStrategyHash] = useState<string | null>(null);

  // Quote state
  const [latestQuote, setLatestQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Execution state
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Policy log (separate from general logs)
  const [policyLogs, setPolicyLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs((l) => [...l, {time: new Date().toLocaleTimeString(), message, type}]);
  }, []);

  const addPolicyLog = useCallback((message: string, type: LogEntry['type'] = 'policy') => {
    setPolicyLogs((l) => [...l, {time: new Date().toLocaleTimeString(), message, type}]);
  }, []);

  const fetchBalances = useCallback(async (walletAddress: string) => {
    if (!RPC_URL || !walletAddress) return;
    setBalancesLoading(true);
    try {
      const provider = await embeddedWallet?.getEthereumProvider();
      if (!provider) {
        addLog('No Ethereum provider available', 'error');
        return;
      }

      try {
        const ethHex = await provider.request({method: 'eth_getBalance', params: [walletAddress, 'latest']}) as string;
        const ethWei = parseInt(ethHex.replace(/^0x/, '') || '0', 16);
        setEthBalance((ethWei / 1e18).toFixed(4));
      } catch (error: unknown) {
        addLog(`ETH balance fetch failed: ${errorMessage(error)}`, 'error');
      }

      if (USDC_ADDRESS) {
        try {
          const callData = `0x${['70a08231', walletAddress.slice(2).padStart(64, '0')].join('')}`;
          const usdcHex = await provider.request({method: 'eth_call', params: [{to: USDC_ADDRESS, data: callData}, 'latest']}) as string;
          const usdcRaw = parseInt(usdcHex.replace(/^0x/, '') || '0', 16);
          setUsdcBalance((usdcRaw / 1e6).toFixed(2));
        } catch (error: unknown) {
          addLog(`USDC balance fetch failed: ${errorMessage(error)}`, 'error');
        }
      }
    } catch (error: unknown) {
      addLog(`Balance fetch error: ${errorMessage(error)}`, 'error');
    } finally {
      setBalancesLoading(false);
    }
  }, [embeddedWallet, addLog]);

  const fetchQuoteFromRegistry = useCallback(async () => {
    if (!RPC_URL || !QUOTE_REGISTRY_ADDRESS) return;
    setQuoteLoading(true);
    try {
      const provider = embeddedWallet?.getEthereumProvider();
      if (!provider) return;

      // For demo, we show a mock quote. In production, this would be read from QuoteRegistry.
      // The mock quote simulates what CRE would deliver.
      const mockQuote: Quote = {
        quoteId: '0x' + Buffer.from('mock-cre-quote-' + Date.now().toString()).toString('hex').slice(0, 64),
        price: '200',
        size: '1000000000000000000000',
        expiry: Math.floor(Date.now() / 1000 + 3600).toString(),
        execute: true,
      };
      setLatestQuote(mockQuote);
    } catch (error: unknown) {
      addLog(`Quote fetch failed: ${errorMessage(error)}`, 'error');
    } finally {
      setQuoteLoading(false);
    }
  }, [RPC_URL, QUOTE_REGISTRY_ADDRESS, embeddedWallet, addLog]);

  // Real-time polling
  useEffect(() => {
    if (!embeddedWallet?.address) return;
    const interval = setInterval(() => {
      fetchBalances(embeddedWallet.address);
    }, 10000);
    return () => clearInterval(interval);
  }, [embeddedWallet?.address, fetchBalances]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchQuoteFromRegistry();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchQuoteFromRegistry]);

  // Initial data fetch
  useEffect(() => {
    if (embeddedWallet?.address) {
      fetchBalances(embeddedWallet.address);
    }
  }, [embeddedWallet?.address, fetchBalances]);

  useEffect(() => {
    fetchQuoteFromRegistry();
  }, [fetchQuoteFromRegistry]);

  const addSigner = useCallback(async () => {
    if (!embeddedWallet || !PRIVY_AUTH_KEY_ID || !PRIVY_POLICY_ID) return;
    if (signerAdded) return;
    setAddingSigner(true);
    try {
      await addSigners({
        address: embeddedWallet.address,
        signers: [{
          signerId: PRIVY_AUTH_KEY_ID,
          policyIds: [PRIVY_POLICY_ID],
        }],
      });
      setSignerAdded(true);
      addLog('Scoped signer added for ' + embeddedWallet.address, 'success');
      addPolicyLog('Scoped signer added — policy enforcement active', 'success');
    } catch (error: unknown) {
      const msg = errorMessage(error);
      if (msg.toLowerCase().includes('duplicate signer')) {
        setSignerAdded(true);
        addLog('Scoped signer already exists for this wallet', 'success');
        addPolicyLog('Scoped signer already exists', 'success');
      } else {
        addLog('addSigners error: ' + msg, 'error');
        addPolicyLog('addSigners error: ' + msg, 'error');
      }
    } finally {
      setAddingSigner(false);
    }
  }, [addLog, addPolicyLog, addSigners, embeddedWallet, signerAdded]);

  useEffect(() => {
    if (authenticated && embeddedWallet && !signerAdded && !addingSigner && PRIVY_AUTH_KEY_ID && PRIVY_POLICY_ID) {
      const timer = window.setTimeout(() => void addSigner(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [addSigner, addingSigner, authenticated, embeddedWallet, signerAdded]);

  useEffect(() => {
    if (!embeddedWallet?.address) return;
    const timer = window.setTimeout(() => void fetchBalances(embeddedWallet.address), 0);
    return () => window.clearTimeout(timer);
  }, [embeddedWallet?.address, fetchBalances]);

  const fundWallet = async () => {
    if (!embeddedWallet) return;
    addLog('To fund your wallet, send test USDC to: ' + embeddedWallet.address, 'info');
    addLog('Sepolia USDC: ' + (USDC_ADDRESS || 'not configured'), 'info');
    addLog(' faucet: https://sepoliafaucet.com/', 'info');
  };

  const sendFromEmbeddedWallet = async (
    to: Hex,
    data: Hex,
    value: Hex = '0x0',
    enforceClientAllowlist = true,
  ) => {
    if (!embeddedWallet) return;
    if (!signerAdded) {
      addLog('Scoped signer not added yet', 'policy');
      addPolicyLog('Transaction blocked: scoped signer not added', 'policy');
      return;
    }
    const allowed = [AQUA_REGISTRY, BACKSTOP_APP_ADDRESS, ALLOWED_ADDRESS, USDC_ADDRESS].filter(Boolean) as string[];
    const lowerTo = to.toLowerCase();
    const isAllowed = allowed.some(a => a.toLowerCase() === lowerTo);
    if (enforceClientAllowlist && !isAllowed) {
      addLog('Transaction blocked by client-side allowlist: ' + to.slice(0, 10) + '... is not an allowed contract', 'policy');
      addPolicyLog('Transaction blocked by client-side allowlist: ' + to.slice(0, 10) + '...', 'policy');
      return;
    }
    try {
      addLog('Sending transaction to ' + to.slice(0, 10) + '...', 'info');
      const hash = await sendTransaction({
        to,
        data,
        value,
        gasLimit: BigInt(300000),
      }, {
        address: embeddedWallet.address,
      });
      addLog('Transaction succeeded: ' + hash.hash, 'success');
      addPolicyLog('Transaction allowed: ' + hash.hash.slice(0, 10) + '...', 'success');
      setTimeout(() => fetchBalances(embeddedWallet.address), 3000);
    } catch (error: unknown) {
      const msg = errorMessage(error);
      if (msg.toLowerCase().includes('policy') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('deny')) {
        addLog('Transaction blocked by Privy policy: ' + msg, 'policy');
        addPolicyLog('Transaction blocked by Privy policy', 'policy');
      } else if (msg.toLowerCase().includes('insufficient funds') || msg.toLowerCase().includes('intrinsic gas too low') || msg.toLowerCase().includes('execution reverted')) {
        addLog('Transaction failed onchain: ' + msg, 'error');
        addPolicyLog('Transaction failed onchain: ' + msg, 'error');
      } else {
        addLog('Transaction failed: ' + msg, 'error');
        addPolicyLog('Transaction failed: ' + msg, 'error');
      }
    }
  };

  const approveAqua = async () => {
    if (!embeddedWallet || !AQUA_REGISTRY || !USDC_ADDRESS) {
      addLog('Missing addresses for approve', 'error');
      return;
    }
    try {
      addLog('Sending approve(' + AQUA_REGISTRY.slice(0, 8) + '...) from ' + embeddedWallet.address.slice(0, 8) + '...', 'info');
      const amount = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const data = '0x' + ['095ea7b3', AQUA_REGISTRY.slice(2).padStart(64, '0'), amount.replace('0x', '')].join('');
      await sendFromEmbeddedWallet(USDC_ADDRESS as Hex, data as Hex, '0x0');
    } catch (error: unknown) {
      addLog('Approve error: ' + errorMessage(error), 'error');
    }
  };

  const shipStrategy = async () => {
    if (!embeddedWallet || !AQUA_REGISTRY || !BACKSTOP_APP_ADDRESS || !USDC_ADDRESS || !WETH_ADDRESS) {
      addLog('Missing addresses for ship', 'error');
      return;
    }
    try {
      addLog('Shipping strategy to ' + BACKSTOP_APP_ADDRESS.slice(0, 8) + '...', 'info');

      const maker = embeddedWallet.address;
      const tokenIn = WETH_ADDRESS;
      const tokenOut = USDC_ADDRESS;
      const maxTrade = (1000 * 1e6).toString();
      const minDiscountBps = '100';
      const maxDiscountBps = '500';
      const expiry = Math.floor(Date.now() / 1000 + 365 * 24 * 60 * 60).toString();
      const salt = '0x0000000000000000000000000000000000000000000000000000000000000000';

      const strategyBody = [
        maker.slice(2).padStart(64, '0'),
        tokenIn.slice(2).padStart(64, '0'),
        tokenOut.slice(2).padStart(64, '0'),
        maxTrade.padStart(64, '0'),
        minDiscountBps.padStart(64, '0'),
        maxDiscountBps.padStart(64, '0'),
        expiry.padStart(64, '0'),
        salt.slice(2).padStart(64, '0'),
      ].join('');

      const data = encodeAquaShip(BACKSTOP_APP_ADDRESS, strategyBody, [USDC_ADDRESS], [BigInt(1000 * 1e6)]);
      await sendFromEmbeddedWallet(AQUA_REGISTRY as Hex, data as Hex, '0x0');

      // Update strategy state after successful ship
      setStrategy({
        maker,
        tokenIn,
        tokenOut,
        maxTrade: (parseFloat(maxTrade) / 1e6).toFixed(0),
        minDiscountBps,
        maxDiscountBps,
        expiry: new Date(parseInt(expiry) * 1000).toISOString().split('T')[0],
        salt: '0x0',
      });
      addLog('Strategy shipped successfully', 'success');
    } catch (error: unknown) {
      addLog('Ship error: ' + errorMessage(error), 'error');
    }
  };

  const testWithinPolicyTx = async () => {
    if (!embeddedWallet || !USDC_ADDRESS) {
      addLog('Missing embedded wallet or USDC address for policy test', 'error');
      return;
    }
    const transferZero = '0xa9059cbb' + embeddedWallet.address.slice(2).padStart(64, '0') + '0'.padStart(64, '0');
    addLog('Submitting zero-USDC transfer through the scoped signer', 'info');
    await sendFromEmbeddedWallet(USDC_ADDRESS as Hex, transferZero as Hex, '0x0');
  };

  const testOutsidePolicyTx = async () => {
    const target = '0x1111111111111111111111111111111111111111';
    addLog('Testing client-side allowlist with disallowed recipient ' + target.slice(0, 10) + '...', 'info');
    await sendFromEmbeddedWallet(target, '0x', '0x0');
  };

  const simulateSwap = async () => {
    if (!strategy || !latestQuote) {
      addLog('No strategy or quote available for swap', 'error');
      return;
    }
    if (!embeddedWallet) {
      addLog('No embedded wallet', 'error');
      return;
    }

    const makerUsdcBefore = usdcBalance || '0';
    const makerWethBefore = ethBalance || '0';

    addLog('Simulating swap: pulling ' + (parseFloat(latestQuote.size) / 1e6).toFixed(0) + ' USDC, pushing WETH', 'info');

    // Simulate the swap result
    setTimeout(() => {
      const pulled = parseFloat(latestQuote.size);
      setExecutionResult({
        txHash: '0x' + Buffer.from('simulated-tx-' + Date.now()).toString('hex').slice(0, 64),
        timestamp: new Date().toLocaleTimeString(),
        usdcPulled: pulled.toFixed(0),
        wethPushed: pulled.toFixed(0),
        makerUsdcBefore,
        makerUsdcAfter: (parseFloat(makerUsdcBefore) - pulled / 1e6).toFixed(2),
        makerWethBefore: makerWethBefore,
        makerWethAfter: (parseFloat(makerWethBefore) + pulled / 1e18).toFixed(4),
      });
      addLog('Swap executed: ' + pulled.toFixed(0) + ' USDC pulled, ' + pulled.toFixed(0) + ' WETH pushed', 'success');
      addPolicyLog('Swap executed successfully', 'success');
      fetchBalances(embeddedWallet.address);
    }, 1000);
  };

  if (!ready) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading Privy...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-4xl flex-col items-center justify-between py-16 px-8 bg-white dark:bg-black sm:items-start">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          Confidential Liquidation Backstop
        </h1>

        {!authenticated ? (
          <button
            onClick={login}
            className="rounded-full bg-foreground px-5 py-3 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Login with Privy
          </button>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            {/* Maker Capital */}
            <section className="p-4 border border-zinc-200 dark:border-zinc-800 rounded">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Maker Capital</h2>
              <p className="text-sm text-zinc-500">In-wallet balances on Sepolia</p>
              {embeddedWallet ? (
                <div className="mt-2 flex flex-col gap-1">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Wallet: {embeddedWallet.address}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    ETH: {ethBalance !== null ? `${ethBalance} ETH` : 'loading...'}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    USDC: {usdcBalance !== null ? `${usdcBalance} USDC` : 'loading...'}
                  </p>
                  <p className="text-xs text-zinc-400">Network: Sepolia (chainId {CHAIN_ID})</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No embedded wallet found</p>
              )}
            </section>

            {/* Active Strategy */}
            <section className="p-4 border border-zinc-200 dark:border-zinc-800 rounded">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Active Strategy</h2>
              <p className="text-sm text-zinc-500">Immutable bounds shipped via Aqua</p>
              {strategy ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Maker:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.maker.slice(0, 10)}...</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Token In (push):</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.tokenIn.slice(0, 10)}...</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Token Out (pull):</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.tokenOut.slice(0, 10)}...</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Max Trade:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.maxTrade} USDC</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Min Discount:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.minDiscountBps} bps</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Max Discount:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.maxDiscountBps} bps</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Expiry:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.expiry}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Salt:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{strategy.salt}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 mt-2">No strategy shipped yet. Use the Maker Onboarding section below.</p>
              )}
            </section>

            {/* Live Opportunity */}
            <section className="p-4 border border-zinc-200 dark:border-zinc-800 rounded">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Live Opportunity</h2>
              <p className="text-sm text-zinc-500">Mock CRE quote + borrower health factor</p>
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500">Latest Quote (mock CRE):</span>
                  {latestQuote ? (
                    <div className="flex gap-4 text-sm">
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">Price: {latestQuote.price} bps</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">Size: {(parseFloat(latestQuote.size) / 1e6).toFixed(0)} USDC</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">Expiry: {new Date(parseInt(latestQuote.expiry) * 1000).toLocaleTimeString()}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-500">{quoteLoading ? 'loading...' : 'no quote yet'}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500">Borrower Health Factor:</span>
                  <span className="text-sm font-mono text-red-600 dark:text-red-400">0.85 (under-collateralized)</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500">Quote ID:</span>
                  <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all">
                    {latestQuote ? latestQuote.quoteId.slice(0, 32) + '...' : '—'}
                  </span>
                </div>
              </div>
            </section>

            {/* Execution Result */}
            <section className="p-4 border border-zinc-200 dark:border-zinc-800 rounded">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Execution Result</h2>
              <p className="text-sm text-zinc-500">Last swap outcome</p>
              {executionResult ? (
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <div>
                    <span className="text-zinc-500">Tx Hash:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300 break-all">{executionResult.txHash}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Time:</span>
                    <span className="ml-2 font-mono text-zinc-700 dark:text-zinc-300">{executionResult.timestamp}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-zinc-500">USDC Pulled:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{executionResult.usdcPulled}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-zinc-500">WETH Pushed:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{executionResult.wethPushed}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-zinc-500">Maker USDC:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{executionResult.makerUsdcBefore} → {executionResult.makerUsdcAfter}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-zinc-500">Maker WETH:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{executionResult.makerWethBefore} → {executionResult.makerWethAfter}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 mt-2">No execution yet. Execute a swap to see results here.</p>
              )}
            </section>

            {/* Maker Onboarding */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Maker Onboarding</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={fundWallet}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Fund Wallet (USDC)
                </button>
                <button
                  onClick={() => embeddedWallet?.address && fetchBalances(embeddedWallet.address)}
                  disabled={balancesLoading}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] disabled:opacity-50"
                >
                  Refresh Balances
                </button>
                <button
                  onClick={approveAqua}
                  disabled={!signerAdded}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] disabled:opacity-50"
                >
                  Approve Aqua
                </button>
                <button
                  onClick={shipStrategy}
                  disabled={!signerAdded}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] disabled:opacity-50"
                >
                  Ship Strategy
                </button>
                <button
                  onClick={simulateSwap}
                  disabled={!strategy || !latestQuote}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] disabled:opacity-50"
                >
                  Simulate Swap
                </button>
              </div>
            </div>

            {/* Policy Tests */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Policy Tests</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={testWithinPolicyTx}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Test Within-Policy Tx
                </button>
                <button
                  onClick={testOutsidePolicyTx}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Test Disallowed Client-Side Tx
                </button>
              </div>
            </div>

            {/* Failure Mode Demos */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Failure Mode Demos</p>
              <p className="text-xs text-zinc-500">Each button simulates a contract-level revert that would occur during swap execution.</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => addLog('Mock: Quote expired — block.timestamp > quote.expiry', 'error')}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Expired Quote
                </button>
                <button
                  onClick={() => addLog('Mock: Quote size exceeds maxTrade — 2,000 USDC greater-than 1,000 USDC', 'error')}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Size greater-than maxTrade
                </button>
                <button
                  onClick={() => addLog('Mock: Price below min discount — 50 bps less-than 100 bps', 'error')}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Price Below Min
                </button>
                <button
                  onClick={() => addLog('Mock: Price above max discount — 600 bps greater-than 500 bps', 'error')}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Price Above Max
                </button>
                <button
                  onClick={() => addLog('Mock: Unauthorized QuoteRegistry write — InvalidSender(0x9999, forwarder)', 'error')}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Unauthorized Registry Write
                </button>
              </div>
            </div>

            {/* Policy Log */}
            <section className="p-4 border border-zinc-200 dark:border-zinc-800 rounded">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Policy Log</h2>
              <p className="text-sm text-zinc-500">Accept / reject events from Privy</p>
              {policyLogs.length > 0 ? (
                <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-900 rounded">
                  {policyLogs.map((log, i) => (
                    <p key={i} className={`text-sm font-mono ${log.type === 'policy' ? 'text-red-600 dark:text-red-400' : log.type === 'success' ? 'text-green-600 dark:text-green-400' : log.type === 'error' ? 'text-red-600 dark:text-red-400' : ''}`}>
                      [{log.time}] {log.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 mt-2">No policy events yet.</p>
              )}
            </section>

            {/* General Logs */}
            {logs.length > 0 && (
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded">
                <p className="text-sm font-mono font-bold">Logs:</p>
                {logs.map((log, i) => (
                  <p key={i} className={`text-sm font-mono ${log.type === 'policy' ? 'text-red-600 dark:text-red-400' : log.type === 'success' ? 'text-green-600 dark:text-green-400' : log.type === 'error' ? 'text-red-600 dark:text-red-400' : ''}`}>
                    [{log.time}] {log.message}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={logout}
              className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Logout
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
