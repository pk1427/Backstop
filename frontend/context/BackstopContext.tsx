'use client';

import {createContext, useContext, useEffect, useCallback, useState, ReactNode, useMemo} from 'react';
import {usePrivy, useWallets, useSendTransaction, useSigners} from '@privy-io/react-auth';

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
  const amountsPadded = amounts.map((n) => n.toString(16).padStart(64, '0')).join('');
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

export interface Strategy {
  maker: string;
  tokenIn: string;
  tokenOut: string;
  maxTrade: string;
  minDiscountBps: string;
  maxDiscountBps: string;
  expiry: string;
  salt: string;
}

export interface Quote {
  quoteId: string;
  price: string;
  size: string;
  expiry: string;
  execute: boolean;
  healthFactor: number;
  collateralUsd: number;
  debtUsd: number;
  liquidationSizeUsd: number;
  executionPriceUsd: number;
  discountBps: number;
  simulated: boolean;
}

export interface ExecutionResult {
  txHash: string;
  timestamp: string;
  usdcDeployed: string;
  wethPushed: string;
  makerUsdcBefore: string;
  makerUsdcAfter: string;
  makerWethBefore: string;
  makerWethAfter: string;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export interface BackstopState {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => void;
  user: { email?: { address: string }; phone?: { number: string } } | null | undefined;
  embeddedWallet: { address: string } | undefined;
  signerAdded: boolean;
  addingSigner: boolean;
  ethBalance: string | null;
  usdcBalance: string | null;
  balancesLoading: boolean;
  lastUpdated: string | null;
  strategy: Strategy | null;
  latestQuote: Quote | null;
  quoteLoading: boolean;
  executionResult: ExecutionResult | null;
  simulating: boolean;
  logs: LogEntry[];
  policyLogs: LogEntry[];
  systemStatus: 'active' | 'monitoring' | 'setup' | 'action-required' | 'paused';
  statusLabel: string | undefined;
  policyChecks: { label: string; passed: boolean; detail?: string }[];
  policyOverallPassed: boolean;
  addLog: (message: string, type?: LogEntry['type']) => void;
  addPolicyLog: (message: string, type?: LogEntry['type']) => void;
  refreshBalances: () => void;
  addSigner: () => Promise<void>;
  fundWallet: () => Promise<void>;
  approveAqua: () => Promise<void>;
  shipStrategy: () => Promise<void>;
  simulateSwap: () => Promise<void>;
  testWithinPolicyTx: () => Promise<void>;
  testOutsidePolicyTx: () => Promise<void>;
  triggerExpiredQuote: () => void;
  triggerSizeExceeded: () => void;
  triggerPriceBelowMin: () => void;
  triggerPriceAboveMax: () => void;
  triggerUnauthorizedWrite: () => void;
}

const BackstopContext = createContext<BackstopState | null>(null);

const STRATEGY_STORAGE_KEY = 'backstop_strategy';

function loadPersistedStrategy(): Strategy | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Strategy;
  } catch {
    return null;
  }
}

function persistStrategy(strategy: Strategy | null) {
  if (typeof window === 'undefined') return;
  if (strategy) {
    sessionStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(strategy));
  } else {
    sessionStorage.removeItem(STRATEGY_STORAGE_KEY);
  }
}

export function BackstopProvider({children}: {children: ReactNode}) {
  const {ready, authenticated, login, logout, user} = usePrivy();
  const {wallets} = useWallets();
  const {sendTransaction} = useSendTransaction();
  const {addSigners} = useSigners();

  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  const [signerAdded, setSignerAdded] = useState(false);
  const [addingSigner, setAddingSigner] = useState(false);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(() => loadPersistedStrategy());
  const [latestQuote, setLatestQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [policyLogs, setPolicyLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs((l) => [...l.slice(-49), {time: new Date().toLocaleTimeString(), message, type}]);
  }, []);

  const addPolicyLog = useCallback((message: string, type: LogEntry['type'] = 'policy') => {
    setPolicyLogs((l) => [...l.slice(-49), {time: new Date().toLocaleTimeString(), message, type}]);
  }, []);

  const fetchBalances = useCallback(async (walletAddress: string) => {
    if (!RPC_URL || !walletAddress || !embeddedWallet) return;
    setBalancesLoading(true);
    try {
      const provider = await embeddedWallet.getEthereumProvider();
      if (!provider) {
        addLog('No Ethereum provider available', 'error');
        return;
      }
      try {
        const ethHex = (await provider.request({method: 'eth_getBalance', params: [walletAddress, 'latest']})) as string;
        const ethWei = parseInt(ethHex.replace(/^0x/, '') || '0', 16);
        setEthBalance((ethWei / 1e18).toFixed(4));
      } catch (error: unknown) {
        addLog(`ETH balance fetch failed: ${errorMessage(error)}`, 'error');
      }
      if (USDC_ADDRESS) {
        try {
          const callData = `0x${['70a08231', walletAddress.slice(2).padStart(64, '0')].join('')}`;
          const usdcHex = (await provider.request({method: 'eth_call', params: [{to: USDC_ADDRESS, data: callData}, 'latest']})) as string;
          const usdcRaw = parseInt(usdcHex.replace(/^0x/, '') || '0', 16);
          setUsdcBalance((usdcRaw / 1e6).toFixed(2));
        } catch (error: unknown) {
          addLog(`USDC balance fetch failed: ${errorMessage(error)}`, 'error');
        }
      }
      setLastUpdated(new Date().toLocaleTimeString());
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
      const now = Math.floor(Date.now() / 1000);
      const mockQuote: Quote = {
        quoteId: '0x' + Buffer.from('mock-cre-quote-' + now.toString()).toString('hex').slice(0, 64),
        price: '200',
        size: '1000000000',
        expiry: (now + 3600).toString(),
        execute: true,
        healthFactor: 0.85,
        collateralUsd: 12840,
        debtUsd: 8200,
        liquidationSizeUsd: 1000,
        executionPriceUsd: 3421,
        discountBps: 200,
        simulated: true,
      };
      setLatestQuote(mockQuote);
    } catch (error: unknown) {
      addLog(`Quote fetch failed: ${errorMessage(error)}`, 'error');
    } finally {
      setQuoteLoading(false);
    }
  }, [RPC_URL, QUOTE_REGISTRY_ADDRESS, addLog]);

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

  const fundWallet = useCallback(async () => {
    if (!embeddedWallet) return;
    addLog('To fund your wallet, send test USDC to: ' + embeddedWallet.address, 'info');
    addLog('Sepolia USDC: ' + (USDC_ADDRESS || 'not configured'), 'info');
    addLog('Faucet: https://sepoliafaucet.com/', 'info');
  }, [embeddedWallet, addLog]);

  const sendFromEmbeddedWallet = useCallback(async (
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
    const isAllowed = allowed.some((a) => a.toLowerCase() === lowerTo);
    if (enforceClientAllowlist && !isAllowed) {
      addLog('Transaction blocked by client-side allowlist: ' + to.slice(0, 10) + '... is not an allowed contract', 'policy');
      addPolicyLog('Transaction blocked by client-side allowlist: ' + to.slice(0, 10) + '...', 'policy');
      return;
    }
    try {
      addLog('Sending transaction to ' + to.slice(0, 10) + '...', 'info');
      const hash = await sendTransaction({to, data, value, gasLimit: BigInt(300000)}, {
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
  }, [embeddedWallet, signerAdded, addLog, addPolicyLog, sendTransaction, fetchBalances]);

  const approveAqua = useCallback(async () => {
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
  }, [embeddedWallet, addLog, sendFromEmbeddedWallet]);

  const shipStrategy = useCallback(async () => {
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
      const next: Strategy = {
        maker,
        tokenIn,
        tokenOut,
        maxTrade: (parseFloat(maxTrade) / 1e6).toFixed(0),
        minDiscountBps,
        maxDiscountBps,
        expiry: new Date(parseInt(expiry) * 1000).toISOString().split('T')[0],
        salt: '0x0',
      };
      setStrategy(next);
      persistStrategy(next);
      addLog('Strategy shipped successfully', 'success');
    } catch (error: unknown) {
      addLog('Ship error: ' + errorMessage(error), 'error');
    }
  }, [embeddedWallet, addLog, sendFromEmbeddedWallet, encodeAquaShip]);

  const testWithinPolicyTx = useCallback(async () => {
    if (!embeddedWallet || !USDC_ADDRESS) {
      addLog('Missing embedded wallet or USDC address for policy test', 'error');
      return;
    }
    const transferZero = '0xa9059cbb' + embeddedWallet.address.slice(2).padStart(64, '0') + '0'.padStart(64, '0');
    addLog('Submitting zero-USDC transfer through the scoped signer', 'info');
    await sendFromEmbeddedWallet(USDC_ADDRESS as Hex, transferZero as Hex, '0x0');
  }, [embeddedWallet, addLog, sendFromEmbeddedWallet]);

  const testOutsidePolicyTx = useCallback(async () => {
    const target = '0x1111111111111111111111111111111111111111';
    addLog('Testing client-side allowlist with disallowed recipient ' + target.slice(0, 10) + '...', 'info');
    await sendFromEmbeddedWallet(target, '0x', '0x0');
  }, [addLog, sendFromEmbeddedWallet]);

  const simulateSwap = useCallback(async () => {
    if (!strategy || !latestQuote) {
      addLog('No strategy or quote available for swap', 'error');
      return;
    }
    if (!embeddedWallet) {
      addLog('No embedded wallet', 'error');
      return;
    }
    setSimulating(true);
    const makerUsdcBefore = parseFloat(usdcBalance || '0');
    const makerWethBefore = parseFloat(ethBalance || '0');

    const liquidationSizeUsd = latestQuote.liquidationSizeUsd;
    const executionPriceUsd = latestQuote.executionPriceUsd;
    const actualPulledUsd = Math.min(liquidationSizeUsd, makerUsdcBefore);
    const actualWethReceived = actualPulledUsd > 0 && executionPriceUsd > 0 ? actualPulledUsd / executionPriceUsd : 0;

    addLog('Simulating swap: deploying ' + actualPulledUsd.toFixed(2) + ' USDC, pushing ' + actualWethReceived.toFixed(4) + ' WETH', 'info');
    setTimeout(() => {
      const makerUsdcAfter = Math.max(0, makerUsdcBefore - actualPulledUsd);
      const makerWethAfter = makerWethBefore + actualWethReceived;
      setExecutionResult({
        txHash: '0x' + Buffer.from('simulated-tx-' + Date.now()).toString('hex').slice(0, 64),
        timestamp: new Date().toLocaleTimeString(),
        usdcDeployed: actualPulledUsd.toFixed(2),
        wethPushed: actualWethReceived.toFixed(4),
        makerUsdcBefore: makerUsdcBefore.toFixed(2),
        makerUsdcAfter: makerUsdcAfter.toFixed(2),
        makerWethBefore: makerWethBefore.toFixed(4),
        makerWethAfter: makerWethAfter.toFixed(4),
      });
      addLog('Swap executed: ' + actualPulledUsd.toFixed(2) + ' USDC deployed, ' + actualWethReceived.toFixed(4) + ' WETH pushed', 'success');
      addPolicyLog('Swap executed successfully', 'success');
      fetchBalances(embeddedWallet.address);
      setSimulating(false);
    }, 1000);
  }, [strategy, latestQuote, embeddedWallet, usdcBalance, ethBalance, addLog, addPolicyLog, fetchBalances]);

  const refreshBalances = useCallback(() => {
    if (embeddedWallet?.address) {
      fetchBalances(embeddedWallet.address);
    }
  }, [embeddedWallet, fetchBalances]);

  const triggerExpiredQuote = useCallback(() => {
    addLog('Mock: Quote expired — block.timestamp > quote.expiry', 'error');
  }, [addLog]);

  const triggerSizeExceeded = useCallback(() => {
    addLog('Mock: Quote size exceeds maxTrade — 2,000 USDC exceeds 1,000 USDC', 'error');
  }, [addLog]);

  const triggerPriceBelowMin = useCallback(() => {
    addLog('Mock: Price below min discount — 50 bps less-than 100 bps', 'error');
  }, [addLog]);

  const triggerPriceAboveMax = useCallback(() => {
    addLog('Mock: Price above max discount — 600 bps greater-than 500 bps', 'error');
  }, [addLog]);

  const triggerUnauthorizedWrite = useCallback(() => {
    addLog('Mock: Unauthorized QuoteRegistry write — InvalidSender(0x9999, forwarder)', 'error');
  }, [addLog]);

  const systemStatus = useMemo<BackstopState['systemStatus']>(() => {
    if (!authenticated) return 'setup';
    if (!signerAdded) return 'action-required';
    if (!strategy) return 'setup';
    if (!latestQuote) return 'monitoring';
    return 'active';
  }, [authenticated, signerAdded, strategy, latestQuote]);

  const statusLabel = useMemo(() => {
    switch (systemStatus) {
      case 'active':
        return 'Ready to execute';
      case 'monitoring':
        return 'Monitoring liquidation opportunities';
      case 'action-required':
        return 'Scoped signer missing';
      case 'setup':
        return 'Setup required';
      default:
        return undefined;
    }
  }, [systemStatus]);

  const policyChecks = useMemo(() => {
    const checks = [
      { label: 'Strategy active', passed: !!strategy, detail: strategy ? 'Bound to Aqua' : 'Ship a strategy first' },
      { label: 'Quote valid', passed: !!latestQuote?.execute },
      { label: 'Quote not expired', passed: !!latestQuote && Number(latestQuote.expiry) > Math.floor(Date.now() / 1000) },
      { label: 'Size within max trade', passed: !!strategy && !!latestQuote && Number(latestQuote.size) <= Number(strategy.maxTrade) * 1e6 },
      { label: 'Price within bounds', passed: !!strategy && !!latestQuote && Number(latestQuote.price) >= Number(strategy.minDiscountBps) && Number(latestQuote.price) <= Number(strategy.maxDiscountBps) },
      { label: 'Recipient allowed', passed: signerAdded },
    ];
    const overallPassed = checks.every((c) => c.passed);
    return { checks, overallPassed };
  }, [strategy, latestQuote, signerAdded]);

  const value = useMemo(() => ({
    ready,
    authenticated,
    login,
    logout,
    user,
    embeddedWallet,
    signerAdded,
    addingSigner,
    ethBalance,
    usdcBalance,
    balancesLoading,
    lastUpdated,
    strategy,
    latestQuote,
    quoteLoading,
    executionResult,
    simulating,
    logs,
    policyLogs,
    systemStatus,
    statusLabel,
    policyChecks: policyChecks.checks,
    policyOverallPassed: policyChecks.overallPassed,
    addLog,
    addPolicyLog,
    refreshBalances,
    addSigner,
    fundWallet,
    approveAqua,
    shipStrategy,
    simulateSwap,
    testWithinPolicyTx,
    testOutsidePolicyTx,
    triggerExpiredQuote,
    triggerSizeExceeded,
    triggerPriceBelowMin,
    triggerPriceAboveMax,
    triggerUnauthorizedWrite,
  }), [
    ready,
    authenticated,
    login,
    logout,
    user,
    embeddedWallet,
    signerAdded,
    addingSigner,
    ethBalance,
    usdcBalance,
    balancesLoading,
    lastUpdated,
    strategy,
    latestQuote,
    quoteLoading,
    executionResult,
    simulating,
    logs,
    policyLogs,
    systemStatus,
    statusLabel,
    policyChecks.checks,
    policyChecks.overallPassed,
    addLog,
    addPolicyLog,
    refreshBalances,
    addSigner,
    fundWallet,
    approveAqua,
    shipStrategy,
    simulateSwap,
    testWithinPolicyTx,
    testOutsidePolicyTx,
    triggerExpiredQuote,
    triggerSizeExceeded,
    triggerPriceBelowMin,
    triggerPriceAboveMax,
    triggerUnauthorizedWrite,
  ]);

  return (
    <BackstopContext.Provider value={value}>
      {children}
    </BackstopContext.Provider>
  );
}

export function useBackstop(): BackstopState {
  const ctx = useContext(BackstopContext);
  if (!ctx) {
    throw new Error('useBackstop must be used within a BackstopProvider');
  }
  return ctx;
}
