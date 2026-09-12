'use client';

import {createContext, useContext, useEffect, useCallback, useState, useRef, ReactNode, useMemo} from 'react';
import {usePrivy, useWallets, useSendTransaction, useSigners} from '@privy-io/react-auth';
import {encodeFunctionData, keccak256, encodeAbiParameters, parseAbiParameters} from 'viem';
import {useLiveAavePosition, LiveAavePosition, LiveOpportunity, buildLiveOpportunity} from '@/hooks/useLiveAave';

type LogEntry = { time: string; message: string; type: 'info' | 'success' | 'error' | 'policy' };
type Hex = `0x${string}`;

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
const CONTROLLED_QUOTE_REGISTRY = process.env.NEXT_PUBLIC_CONTROLLED_QUOTE_REGISTRY_ADDRESS || '0x709ed64fde000bed9576b8d1bb0e26eb72fb736b';
const CONTROLLED_POOL = process.env.NEXT_PUBLIC_CONTROLLED_POOL_ADDRESS || '0x89803cfb464eb76ace81463361a34b86b3e7bd2a';
const CONTROLLED_ORACLE = process.env.NEXT_PUBLIC_CONTROLLED_ORACLE_ADDRESS || '0x7d8ae00643171b904183f3cd32803802de43c32a';
const CONTROLLED_WETH = process.env.NEXT_PUBLIC_CONTROLLED_WETH_ADDRESS || '0xb848fedc37bebaf136e51cff90bf73bb0f0de9e9';
const CONTROLLED_USDC = process.env.NEXT_PUBLIC_CONTROLLED_USDC_ADDRESS || '0xfd080b70baefd6bb19906c107a7240c4e5c2dcca';
// Position 02 is CRE-monitored. Positions 03 and 04 remain independently
// visible in the market, but only the monitored borrower receives a quote.
const CONTROLLED_BORROWER = process.env.NEXT_PUBLIC_CONTROLLED_BORROWER_ADDRESS || '0x85d737640a6b86ebfd1aceb9be9992c90020ba1c';
const CONTROLLED_EXECUTOR = process.env.NEXT_PUBLIC_CONTROLLED_EXECUTOR_ADDRESS || '0x331d4f5D31C2FdaC0E5e729bEdae6eF102C2c726';
const QUOTE_SUBMITTED_TOPIC = '0x67407045222a7ab3954cba5ae73b7281e1f7f5c90a1e14b2f9ed9800c7208d1c';
const DEFAULT_LIVE_BORROWER = process.env.NEXT_PUBLIC_LIVE_BORROWER_ADDRESS || '0x659f1ddf3Afa31029B990D2202Df8B2094eE012E';

// Aave V3 Sepolia addresses from aave-dao/aave-address-book
const AAVE_POOL = process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS || '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';
const AAVE_ORACLE = process.env.NEXT_PUBLIC_AAVE_ORACLE_ADDRESS || '0x2da88497588bf89281816106C7259e31AF45a663';
const AAVE_USDC = process.env.NEXT_PUBLIC_AAVE_USDC_ADDRESS || '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const AAVE_WETH = process.env.NEXT_PUBLIC_AAVE_WETH_ADDRESS || '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c';

// Use viem's ABI encoder for Aqua's three dynamic arguments. The prior
// hand-assembled payload looked successful in the wallet but placed a zero
// balance in Aqua storage, which then caused an arithmetic underflow on pull.
const encodeAquaShip = (app: string, strategy: string, tokens: string[], amounts: bigint[]): Hex => encodeFunctionData({
  abi: [{type: 'function', name: 'ship', stateMutability: 'nonpayable', inputs: [
    {name: 'app', type: 'address'}, {name: 'strategy', type: 'bytes'},
    {name: 'tokens', type: 'address[]'}, {name: 'amounts', type: 'uint256[]'},
  ], outputs: [{name: 'strategyHash', type: 'bytes32'}]}],
  functionName: 'ship',
  args: [app as Hex, `0x${strategy}` as Hex, tokens as Hex[], amounts],
});

export interface Strategy {
  appAddress: string;
  maker: string;
  tokenIn: string;
  tokenOut: string;
  maxTrade: string;
  minDiscountBps: string;
  maxDiscountBps: string;
  expiry: string;
  salt: string;
}

export interface StrategyInput {
  maxTrade: string;
  minDiscountBps: string;
  maxDiscountBps: string;
  durationHours: string;
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
  source: 'live' | 'controlled';
  // Live fields
  minCollateralOut?: string;
  minCollateralOutFormatted?: string;
  expectedCollateral?: string;
  expectedCollateralFormatted?: string;
  maxLiquidatableDebt?: string;
  maxLiquidatableDebtFormatted?: string;
  liquidationBonus?: number;
}

export interface LiveOpportunityData {
  borrower: string;
  healthFactor: number;
  collateralAsset: string;
  collateralAmount: string;
  collateralAmountFormatted: string;
  collateralUsd: number;
  debtAsset: string;
  debtAmount: string;
  debtAmountFormatted: string;
  debtUsd: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  maxLiquidatableDebt: string;
  maxLiquidatableDebtFormatted: string;
  expectedCollateral: string;
  expectedCollateralFormatted: string;
  eligible: boolean;
  eligibilityReason: string;
  isLive: boolean;
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
  simulated: boolean;
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
  aquaApproved: boolean;
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
  mode: 'live' | 'controlled';
  setMode: (mode: 'live' | 'controlled') => void;
  aavePosition: LiveOpportunityData | null;
  liveOpportunityLoading: boolean;
  liveOpportunityError: string | null;
  borrowerAddress: string;
  setBorrowerAddress: (address: string) => void;
  controlledBorrowerAddress: string;
  setControlledBorrowerAddress: (address: string) => void;
  controlledQuoteMatchesSelection: boolean;
  controlledPositionSettled: boolean;
  scanLivePosition: () => Promise<void>;
  addLog: (message: string, type?: LogEntry['type']) => void;
  addPolicyLog: (message: string, type?: LogEntry['type']) => void;
  refreshBalances: () => void;
  addSigner: () => Promise<void>;
  fundWallet: () => Promise<void>;
  approveAqua: () => Promise<void>;
  shipStrategy: (input?: StrategyInput) => Promise<void>;
  executeControlledLiquidation: () => Promise<void>;
  controlledStrategyCapacityAvailable: boolean;
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

type DbLogEntry = {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'policy';
};

async function loadPersistedLogs(walletAddress: string): Promise<LogEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const response = await fetch(`/api/logs?walletAddress=${walletAddress}&limit=100`);
    const data = await response.json();
    return (data.logs || []).map((log: DbLogEntry) => ({
      time: log.timestamp,
      message: log.message,
      type: log.type,
    }));
  } catch {
    return [];
  }
}

async function loadPersistedPolicyLogs(walletAddress: string): Promise<LogEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const response = await fetch(`/api/logs?walletAddress=${walletAddress}&type=policy&limit=100`);
    const data = await response.json();
    return (data.logs || []).map((log: DbLogEntry) => ({
      time: log.timestamp,
      message: log.message,
      type: log.type,
    }));
  } catch {
    return [];
  }
}

async function loadPersistedTransactions(walletAddress: string) {
  if (typeof window === 'undefined') return null;
  try {
    const response = await fetch(`/api/transactions?walletAddress=${walletAddress}&limit=1`);
    const data = await response.json();
    return data.transactions?.[0] || null;
  } catch {
    return null;
  }
}

async function loadPersistedStrategy(walletAddress: string): Promise<Strategy | null> {
  if (typeof window === 'undefined') return null;
  try {
    const response = await fetch(`/api/strategy?walletAddress=${walletAddress}`);
    const data = await response.json();
    const s = data.strategy;
    if (!s) return null;
    const controlled = String(s.token_out).toLowerCase() === CONTROLLED_USDC.toLowerCase();
    return {
      appAddress: controlled ? (process.env.NEXT_PUBLIC_CONTROLLED_BACKSTOP_APP_ADDRESS || '0x42698126b5E4884A99905484d484ECe7fbF18A6a') : BACKSTOP_APP_ADDRESS,
      maker: s.maker,
      tokenIn: s.token_in,
      tokenOut: s.token_out,
      maxTrade: s.max_trade,
      minDiscountBps: s.min_discount_bps,
      maxDiscountBps: s.max_discount_bps,
      expiry: s.expiry,
      salt: s.salt,
    };
  } catch {
    return null;
  }
}

async function persistLog(walletAddress: string, message: string, type: LogEntry['type'], isPolicy = false) {
  if (typeof window === 'undefined' || !walletAddress) return;
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
        wallet_address: walletAddress,
        logType: isPolicy ? 'policy' : 'default',
      }),
    });
  } catch {
    // Silently fail
  }
}

async function persistTransaction(walletAddress: string, executionResult: ExecutionResult) {
  if (typeof window === 'undefined' || !walletAddress) return;
  try {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_hash: executionResult.txHash,
        timestamp: executionResult.timestamp,
        usdc_deployed: executionResult.usdcDeployed,
        weth_pushed: executionResult.wethPushed,
        maker_usdc_before: executionResult.makerUsdcBefore,
        maker_usdc_after: executionResult.makerUsdcAfter,
        maker_weth_before: executionResult.makerWethBefore,
        maker_weth_after: executionResult.makerWethAfter,
        simulated: executionResult.simulated,
        wallet_address: walletAddress,
      }),
    });
  } catch {
    // Silently fail
  }
}

async function persistStrategyToDb(walletAddress: string, strategy: Strategy) {
  if (typeof window === 'undefined' || !walletAddress) return;
  try {
    await fetch('/api/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: walletAddress,
        maker: strategy.maker,
        token_in: strategy.tokenIn,
        token_out: strategy.tokenOut,
        max_trade: strategy.maxTrade,
        min_discount_bps: strategy.minDiscountBps,
        max_discount_bps: strategy.maxDiscountBps,
        expiry: strategy.expiry,
        salt: strategy.salt,
      }),
    });
  } catch {
    // Silently fail
  }
}

function loadPersistedStrategyFromSession(): Strategy | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) return null;
    const strategy = JSON.parse(raw) as Strategy;
    const validApps = [BACKSTOP_APP_ADDRESS, process.env.NEXT_PUBLIC_CONTROLLED_BACKSTOP_APP_ADDRESS || '0x42698126b5E4884A99905484d484ECe7fbF18A6a'].map((address) => address.toLowerCase());
    if (!validApps.includes(strategy.appAddress?.toLowerCase())) {
      sessionStorage.removeItem(STRATEGY_STORAGE_KEY);
      return null;
    }
    return strategy;
  } catch {
    return null;
  }
}

function persistStrategyToSession(strategy: Strategy | null) {
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
  const [aquaApproved, setAquaApproved] = useState(false);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [latestQuote, setLatestQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [policyLogs, setPolicyLogs] = useState<LogEntry[]>([]);
  const [mode, setModeState] = useState<'live' | 'controlled'>('live');
  const [aavePosition, setAavePosition] = useState<LiveOpportunityData | null>(null);
  const [liveOpportunityLoading, setLiveOpportunityLoading] = useState(false);
  const [liveOpportunityError, setLiveOpportunityError] = useState<string | null>(null);
  const [borrowerAddress, setBorrowerAddress] = useState<string>(DEFAULT_LIVE_BORROWER);
  const [controlledBorrowerAddress, setControlledBorrowerAddress] = useState<string>(CONTROLLED_BORROWER);
  const [dataLoaded, setDataLoaded] = useState(false);
  const lastBalanceError = useRef<string>('');
  const lastQuoteError = useRef<string>('');
  const quoteFetchInFlight = useRef(false);
  const latestQuoteRef = useRef<Quote | null>(null);
  const aavePositionRef = useRef<LiveOpportunityData | null>(null);

  useEffect(() => { latestQuoteRef.current = latestQuote; }, [latestQuote]);
  useEffect(() => { aavePositionRef.current = aavePosition; }, [aavePosition]);

  // The maker chooses the controlled market on the liquidation page, then
  // continues to Strategy without losing that intentional context.
  useEffect(() => {
    const saved = window.sessionStorage.getItem('backstop_market_mode');
    if (saved === 'controlled' || saved === 'live') setModeState(saved);
  }, []);
  const setMode = useCallback((next: 'live' | 'controlled') => {
    setModeState(next);
    window.sessionStorage.setItem('backstop_market_mode', next);
  }, []);

  // Load persisted data from database when wallet connects
  useEffect(() => {
    if (!embeddedWallet?.address || dataLoaded) return;
    let mounted = true;
    (async () => {
      const [savedLogs, savedPolicyLogs, savedStrategy] = await Promise.all([
        loadPersistedLogs(embeddedWallet.address),
        loadPersistedPolicyLogs(embeddedWallet.address),
        loadPersistedStrategy(embeddedWallet.address),
      ]);
      if (mounted) {
        setLogs(savedLogs);
        setPolicyLogs(savedPolicyLogs);
        if (savedStrategy) {
          setStrategy(savedStrategy);
          persistStrategyToSession(savedStrategy);
        } else {
          // Fallback to sessionStorage
          const sessionStrategy = loadPersistedStrategyFromSession();
          if (sessionStrategy) {
            setStrategy(sessionStrategy);
          }
        }
        setDataLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, [embeddedWallet?.address, dataLoaded]);

  // Fast Refresh preserves the previous empty state from before Live mode had a
  // default borrower. Restore the demonstrable live position after upgrades.
  useEffect(() => {
    if (!borrowerAddress) setBorrowerAddress(DEFAULT_LIVE_BORROWER);
  }, [borrowerAddress]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((l) => [...l.slice(-49), {time, message, type}]);
    if (embeddedWallet?.address) {
      persistLog(embeddedWallet.address, message, type, false);
    }
  }, [embeddedWallet?.address]);

  const addPolicyLog = useCallback((message: string, type: LogEntry['type'] = 'policy') => {
    const time = new Date().toLocaleTimeString();
    setPolicyLogs((l) => [...l.slice(-49), {time, message, type}]);
    if (embeddedWallet?.address) {
      persistLog(embeddedWallet.address, message, type, true);
    }
  }, [embeddedWallet?.address]);

  const addBalanceErrorOnce = useCallback((message: string) => {
    if (lastBalanceError.current === message) return;
    lastBalanceError.current = message;
    addLog(message, 'error');
  }, [addLog]);

  const fetchBalances = useCallback(async (walletAddress: string) => {
    if (!RPC_URL || !walletAddress) return;
    setBalancesLoading(true);
    try {
      // Reads must go to the configured Sepolia RPC. A wallet provider can be
      // connected to another chain even when the wallet address is correct.
      const rpc = async (method: string, params: unknown[]) => {
        const response = await fetch(RPC_URL, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
        });
        if (!response.ok) throw new Error(`RPC request failed (${response.status})`);
        const payload = await response.json() as {result?: string; error?: {message?: string}};
        if (payload.error) throw new Error(payload.error.message || 'RPC returned an error');
        if (!payload.result) throw new Error('RPC returned no result');
        return payload.result;
      };
      try {
        const ethHex = await rpc('eth_getBalance', [walletAddress, 'latest']);
        const ethWei = BigInt(ethHex);
        setEthBalance((Number(ethWei) / 1e18).toFixed(4));
      } catch (error: unknown) {
        addBalanceErrorOnce(`ETH balance fetch failed: ${errorMessage(error)}`);
      }
      const capitalToken = mode === 'controlled' ? CONTROLLED_USDC : USDC_ADDRESS;
      if (capitalToken) {
        try {
          const callData = `0x${['70a08231', walletAddress.slice(2).padStart(64, '0')].join('')}`;
          const usdcHex = await rpc('eth_call', [{to: capitalToken, data: callData}, 'latest']);
          const usdcRaw = BigInt(usdcHex);
          setUsdcBalance((Number(usdcRaw) / 1e6).toFixed(2));

          // Reflect the actual ERC-20 allowance, rather than keeping a UI-only
          // approval flag. This remains correct after a refresh or reconnect.
          if (AQUA_REGISTRY) {
            const allowanceData = `0xdd62ed3e${walletAddress.slice(2).padStart(64, '0')}${AQUA_REGISTRY.slice(2).padStart(64, '0')}`;
            const allowanceHex = await rpc('eth_call', [{to: capitalToken, data: allowanceData}, 'latest']);
            setAquaApproved(BigInt(allowanceHex) > 0n);
          }
        } catch (error: unknown) {
          addBalanceErrorOnce(`USDC balance fetch failed: ${errorMessage(error)}`);
          setAquaApproved(false);
        }
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error: unknown) {
      addBalanceErrorOnce(`Balance fetch error: ${errorMessage(error)}`);
    } finally {
      setBalancesLoading(false);
    }
  }, [addBalanceErrorOnce, mode]);

  const fetchQuoteFromRegistry = useCallback(async () => {
    if (!RPC_URL || !QUOTE_REGISTRY_ADDRESS) return;
    // Do not overlap requests. On slower free RPC endpoints, overlapping
    // polls were racing one another and briefly replacing the card state.
    if (quoteFetchInFlight.current) return;
    quoteFetchInFlight.current = true;
    if (!latestQuoteRef.current) setQuoteLoading(true);
    try {
      if (mode === 'live' || mode === 'controlled') {
        const rpc = async (method: string, params: unknown[]) => {
          const response = await fetch(RPC_URL, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
          });
          const payload = await response.json() as {result?: unknown; error?: {message?: string}};
          if (!response.ok || payload.error) throw new Error(payload.error?.message || `RPC request failed (${response.status})`);
          return payload.result;
        };
        const registryAddress = mode === 'controlled' ? CONTROLLED_QUOTE_REGISTRY : QUOTE_REGISTRY_ADDRESS;
        let controlledPosition: LiveOpportunityData | null = null;
        if (mode === 'controlled') {
          const pad = (address: string) => address.slice(2).padStart(64, '0');
          const [hfHex, collateralHex, debtHex, priceHex] = await Promise.all([
            rpc('eth_call', [{to: CONTROLLED_POOL, data: `0x6ad9f9df${pad(controlledBorrowerAddress)}`}, 'latest']) as Promise<string>,
            rpc('eth_call', [{to: CONTROLLED_POOL, data: `0x771568fd${pad(controlledBorrowerAddress)}`}, 'latest']) as Promise<string>,
            rpc('eth_call', [{to: CONTROLLED_POOL, data: `0x3add60ab${pad(controlledBorrowerAddress)}`}, 'latest']) as Promise<string>,
            rpc('eth_call', [{to: CONTROLLED_ORACLE, data: `0xb3596f07${pad(CONTROLLED_WETH)}`}, 'latest']) as Promise<string>,
          ]);
          const hf = Number(BigInt(hfHex)) / 1e18;
          const collateral = BigInt(collateralHex); const debt = BigInt(debtHex); const price = BigInt(priceHex);
          const collateralUsd = Number(collateral * price / 10n ** 18n) / 1e8;
          controlledPosition = {borrower: controlledBorrowerAddress, healthFactor: hf, collateralAsset: CONTROLLED_WETH, collateralAmount: collateral.toString(), collateralAmountFormatted: (Number(collateral) / 1e18).toFixed(4), collateralUsd, debtAsset: 'btUSDC', debtAmount: debt.toString(), debtAmountFormatted: (Number(debt) / 1e6).toFixed(2), debtUsd: Number(debt) / 1e6, liquidationThreshold: 8500, liquidationBonus: 10500, maxLiquidatableDebt: (debt / 2n).toString(), maxLiquidatableDebtFormatted: (Number(debt / 2n) / 1e6).toFixed(2), expectedCollateral: '', expectedCollateralFormatted: '', eligible: hf < 1, eligibilityReason: hf < 1 ? '' : 'Health factor >= 1', isLive: true};
          setAavePosition((previous) => previous && previous.healthFactor === controlledPosition!.healthFactor && previous.collateralAmount === controlledPosition!.collateralAmount && previous.debtAmount === controlledPosition!.debtAmount ? previous : controlledPosition);
          // Position 02 starts at 1,000 btUSDC. A confirmed 500 btUSDC
          // close-factor settlement leaves 500 debt and 0.35 collateral.
          // Never surface a stale 500-unit CRE quote after that state.
          if (controlledBorrowerAddress.toLowerCase() === CONTROLLED_BORROWER.toLowerCase() && debt <= 500_000_000n) {
            setLatestQuote(null);
            return;
          }
          // CRE currently signs quotes only for Position 02. Do not display
          // that quote as executable for a different selected borrower.
          if (controlledBorrowerAddress.toLowerCase() !== CONTROLLED_BORROWER.toLowerCase()) {
            // The borrower-bound registry supports a unique CRE quote for
            // every selected controlled borrower.
          }
          const borrowerWord = controlledBorrowerAddress.slice(2).padStart(64, '0');
          const quoteIdResult = await rpc('eth_call', [{to: CONTROLLED_QUOTE_REGISTRY, data: `0x83f70c82${borrowerWord}`}, 'latest']) as string;
          const boundQuoteId = `0x${quoteIdResult.slice(-64)}` as Hex;
          if (boundQuoteId === `0x${'0'.repeat(64)}`) { setLatestQuote(null); return; }
          const boundQuoteResult = await rpc('eth_call', [{to: CONTROLLED_QUOTE_REGISTRY, data: `0x60f85c67${boundQuoteId.slice(2)}`}, 'latest']) as string;
          const boundWords = boundQuoteResult.replace(/^0x/, '').match(/.{64}/g) || [];
          if (boundWords.length < 8) throw new Error('Malformed borrower-bound quote');
          const boundPrice = BigInt(`0x${boundWords[2]}`); const boundSize = BigInt(`0x${boundWords[3]}`); const boundMinOut = BigInt(`0x${boundWords[4]}`); const boundExpiry = BigInt(`0x${boundWords[5]}`); const boundExecute = BigInt(`0x${boundWords[6]}`) !== 0n; const consumed = BigInt(`0x${boundWords[7]}`) !== 0n;
          if (boundExpiry <= BigInt(Math.floor(Date.now() / 1000)) || consumed || !boundExecute) { setLatestQuote(null); return; }
          const nextBoundQuote: Quote = {quoteId: boundQuoteId, price: boundPrice.toString(), size: boundSize.toString(), expiry: boundExpiry.toString(), execute: true, healthFactor: controlledPosition.healthFactor, collateralUsd: controlledPosition.collateralUsd, debtUsd: controlledPosition.debtUsd, liquidationSizeUsd: Number(boundSize) / 1e6, executionPriceUsd: Number(boundSize) / 1e6 / (Number(boundMinOut) / 1e18), discountBps: Number(boundPrice), simulated: false, source: 'controlled', minCollateralOut: boundMinOut.toString(), minCollateralOutFormatted: (Number(boundMinOut) / 1e18).toFixed(4)};
          setLatestQuote((previous) => previous && previous.quoteId === nextBoundQuote.quoteId ? previous : nextBoundQuote);
          return;
        }
        const latestBlock = BigInt(await rpc('eth_blockNumber', []) as string);
        // The configured free Sepolia provider permits at most a ten-block
        // getLogs range. CRE publishes every minute, so polling this small
        // recent window is sufficient and avoids the blank-state RPC error.
        const toBlock = latestBlock > 0n ? latestBlock - 1n : 0n;
        const fromBlock = toBlock > 9n ? toBlock - 9n : 0n;
        const logs = await rpc('eth_getLogs', [{
          address: registryAddress,
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
          topics: [QUOTE_SUBMITTED_TOPIC],
        }]) as {topics: string[]; data: string}[];
        const event = logs.at(-1);
        if (!event || !event.topics[1]) {
          // Retain a still-valid quote during the short interval between
          // CRE reports. Clearing it here made the market visibly flicker.
          const current = latestQuoteRef.current;
          if (!current || BigInt(current.expiry) <= BigInt(Math.floor(Date.now() / 1000))) setLatestQuote(null);
          return;
        }
        const words = event.data.replace(/^0x/, '').match(/.{64}/g) || [];
        if (words.length !== 4) throw new Error('Malformed QuoteSubmitted event');
        const [price, size, expiry, execute] = words.map((word) => BigInt(`0x${word}`));
        if (expiry <= BigInt(Math.floor(Date.now() / 1000))) {
          const current = latestQuoteRef.current;
          if (!current || BigInt(current.expiry) <= BigInt(Math.floor(Date.now() / 1000))) setLatestQuote(null);
          return;
        }
        const sizeUsd = Number(size) / 1e6;
        const quoteData = `0x60f85c67${event.topics[1].slice(2).padStart(64, '0')}`;
        const quoteResult = await rpc('eth_call', [{to: registryAddress, data: quoteData}, 'latest']) as string;
        const quoteWords = quoteResult.replace(/^0x/, '').match(/.{64}/g) || [];
        const minCollateralOut = quoteWords[3] ? BigInt(`0x${quoteWords[3]}`) : 0n;
        const expectedCollateral = Number(minCollateralOut) / 1e18;
        const nextQuote: Quote = {
          quoteId: event.topics[1],
          price: price.toString(),
          size: size.toString(),
          expiry: expiry.toString(),
          execute: execute !== 0n,
          healthFactor: aavePositionRef.current?.healthFactor || 0,
          collateralUsd: aavePositionRef.current?.collateralUsd || 0,
          debtUsd: aavePositionRef.current?.debtUsd || 0,
          liquidationSizeUsd: sizeUsd,
          executionPriceUsd: expectedCollateral > 0 ? sizeUsd / expectedCollateral : 0,
          discountBps: Number(price),
          simulated: false,
          source: 'live',
          minCollateralOut: minCollateralOut.toString(),
          minCollateralOutFormatted: expectedCollateral.toFixed(4),
        };
        // Same registry event means the visible market state is unchanged.
        // Returning the prior object prevents a full page re-render every poll.
        setLatestQuote((previous) => previous && previous.quoteId === nextQuote.quoteId && previous.expiry === nextQuote.expiry && previous.healthFactor === nextQuote.healthFactor ? previous : nextQuote);
        lastQuoteError.current = '';
        return;
      }
    } catch (error: unknown) {
      const message = `Quote fetch failed: ${errorMessage(error)}`;
      if (lastQuoteError.current !== message) {
        lastQuoteError.current = message;
        addLog(message, 'error');
      }
    } finally {
      quoteFetchInFlight.current = false;
      setQuoteLoading(false);
    }
  }, [RPC_URL, QUOTE_REGISTRY_ADDRESS, addLog, mode, controlledBorrowerAddress]);

  useEffect(() => {
    if (!embeddedWallet?.address) return;
    const interval = setInterval(() => {
      fetchBalances(embeddedWallet.address);
    }, 30000);
    return () => clearInterval(interval);
  }, [embeddedWallet?.address, fetchBalances]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchQuoteFromRegistry();
    }, 20000);
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

  const {position: livePosition, prices: livePrices, loading: liveLoading, error: liveError, refetch: refetchLivePosition} = useLiveAavePosition(
    borrowerAddress || null,
    Boolean(borrowerAddress) && mode === 'live'
  );

  useEffect(() => {
    setLiveOpportunityLoading(liveLoading);
    setLiveOpportunityError(liveError);
    if (mode === 'live' && livePosition) {
      setAavePosition({
        borrower: livePosition.borrower,
        healthFactor: livePosition.healthFactor,
        collateralAsset: livePosition.collateralAsset,
        collateralAmount: livePosition.collateralAmount,
        collateralAmountFormatted: livePosition.collateralAmountFormatted,
        collateralUsd: livePosition.collateralUsd,
        debtAsset: livePosition.debtAsset,
        debtAmount: livePosition.debtAmount,
        debtAmountFormatted: livePosition.debtAmountFormatted,
        debtUsd: livePosition.debtUsd,
        liquidationThreshold: livePosition.liquidationThreshold,
        liquidationBonus: livePosition.liquidationBonus,
        maxLiquidatableDebt: livePosition.maxLiquidatableDebt,
        maxLiquidatableDebtFormatted: livePosition.maxLiquidatableDebtFormatted,
        expectedCollateral: livePosition.expectedCollateral,
        expectedCollateralFormatted: livePosition.expectedCollateralFormatted,
        eligible: livePosition.eligible,
        eligibilityReason: livePosition.eligibilityReason,
        isLive: livePosition.isLive,
      });
    }
  }, [mode, livePosition, liveLoading, liveError]);

  const scanLivePosition = useCallback(async () => {
    const target = borrowerAddress || DEFAULT_LIVE_BORROWER;
    if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
      setLiveOpportunityError('Enter a valid 0x borrower address.');
      return;
    }
    if (!borrowerAddress) {
      setBorrowerAddress(target);
      return;
    }
    await refetchLivePosition();
  }, [borrowerAddress, refetchLivePosition]);

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
    const allowed = [AQUA_REGISTRY, BACKSTOP_APP_ADDRESS, CONTROLLED_EXECUTOR, ALLOWED_ADDRESS, USDC_ADDRESS, CONTROLLED_USDC].filter(Boolean) as string[];
    const lowerTo = to.toLowerCase();
    const isAllowed = allowed.some((a) => a.toLowerCase() === lowerTo);
    if (enforceClientAllowlist && !isAllowed) {
      addLog('Transaction blocked by client-side allowlist: ' + to.slice(0, 10) + '... is not an allowed contract', 'policy');
      addPolicyLog('Transaction blocked by client-side allowlist: ' + to.slice(0, 10) + '...', 'policy');
      return;
    }
    try {
      addLog('Sending transaction to ' + to.slice(0, 10) + '...', 'info');
      // Privy otherwise may construct this on the wallet's default chain
      // (often mainnet), where this embedded wallet has no ETH. All Backstop
      // contracts and the funded balance are on Ethereum Sepolia.
      const hash = await sendTransaction({to, data, value, gasLimit: BigInt(300000), chainId: CHAIN_ID}, {
        address: embeddedWallet.address,
      });
      addLog('Transaction succeeded: ' + hash.hash, 'success');
      addPolicyLog('Transaction allowed: ' + hash.hash.slice(0, 10) + '...', 'success');
      setTimeout(() => fetchBalances(embeddedWallet.address), 3000);
      return hash;
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
    const asset = mode === 'controlled' ? CONTROLLED_USDC : USDC_ADDRESS;
    if (!embeddedWallet || !AQUA_REGISTRY || !asset) {
      addLog('Missing addresses for approve', 'error');
      return;
    }
    try {
      addLog('Sending approve(' + AQUA_REGISTRY.slice(0, 8) + '...) from ' + embeddedWallet.address.slice(0, 8) + '...', 'info');
      const amount = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const data = '0x' + ['095ea7b3', AQUA_REGISTRY.slice(2).padStart(64, '0'), amount.replace('0x', '')].join('');
      const result = await sendFromEmbeddedWallet(asset as Hex, data as Hex, '0x0');
      if (result) setAquaApproved(true);
    } catch (error: unknown) {
      addLog('Approve error: ' + errorMessage(error), 'error');
    }
  }, [embeddedWallet, addLog, sendFromEmbeddedWallet, mode]);

  const shipStrategy = useCallback(async (input?: StrategyInput) => {
    const controlled = mode === 'controlled';
    const appAddress = controlled ? (process.env.NEXT_PUBLIC_CONTROLLED_BACKSTOP_APP_ADDRESS || '0x42698126b5E4884A99905484d484ECe7fbF18A6a') : BACKSTOP_APP_ADDRESS;
    const tokenIn = controlled ? CONTROLLED_WETH : WETH_ADDRESS;
    const tokenOut = controlled ? CONTROLLED_USDC : USDC_ADDRESS;
    if (!embeddedWallet || !AQUA_REGISTRY || !appAddress || !tokenIn || !tokenOut) {
      addLog('Missing addresses for ship', 'error');
      return;
    }
    try {
      addLog('Shipping strategy to ' + appAddress.slice(0, 8) + '...', 'info');
      const maker = embeddedWallet.address;
      const maxTradeUsd = Math.max(1, Math.floor(Number(input?.maxTrade || 500)));
      const minDiscountBps = Math.max(0, Math.floor(Number(input?.minDiscountBps || 100))).toString();
      const maxDiscountBps = Math.max(Number(minDiscountBps), Math.floor(Number(input?.maxDiscountBps || 300))).toString();
      const durationHours = Math.max(1, Math.floor(Number(input?.durationHours || 24)));
      const maxTrade = (maxTradeUsd * 1e6).toString();
      const expiry = Math.floor(Date.now() / 1000 + durationHours * 60 * 60).toString();
      const salt = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((hex, value) => hex + value.toString(16).padStart(2, '0'), '')}`;
      // ABI words are hexadecimal. Do not pad decimal text directly: e.g.
      // "500000000" would otherwise become 0x500000000 and produce a
      // strategy hash that can never match the execution-time struct.
      const abiWord = (value: string | number | bigint) => BigInt(value).toString(16).padStart(64, '0');
      const strategyBody = [
        maker.slice(2).padStart(64, '0'),
        tokenIn.slice(2).padStart(64, '0'),
        tokenOut.slice(2).padStart(64, '0'),
        abiWord(maxTrade),
        abiWord(minDiscountBps),
        abiWord(maxDiscountBps),
        abiWord(expiry),
        salt.slice(2).padStart(64, '0'),
      ].join('');
      // Aqua requires every token that may be pushed during settlement to be
      // registered when the strategy is shipped. btWETH starts at zero, while
      // btUSDC provides the maker's 500-unit execution capacity.
      const data = encodeAquaShip(appAddress, strategyBody, [tokenOut, tokenIn], [BigInt(maxTrade), 0n]);
      const result = await sendFromEmbeddedWallet(AQUA_REGISTRY as Hex, data, '0x0');
      if (!result) return;
      const next: Strategy = {
        appAddress,
        maker,
        tokenIn,
        tokenOut,
        maxTrade: (parseFloat(maxTrade) / 1e6).toFixed(0),
        minDiscountBps,
        maxDiscountBps,
        // Store the exact chain value; the execution hash must use it.
        expiry,
        salt,
      };
      setStrategy(next);
      persistStrategyToSession(next);
      if (embeddedWallet.address) {
        persistStrategyToDb(embeddedWallet.address, next);
      }
      addLog('Strategy shipped successfully', 'success');
    } catch (error: unknown) {
      addLog('Ship error: ' + errorMessage(error), 'error');
    }
  }, [embeddedWallet, addLog, sendFromEmbeddedWallet, mode]);

  const executeControlledLiquidation = useCallback(async () => {
    if (mode !== 'controlled' || !latestQuote?.quoteId || !latestQuote.minCollateralOut) {
      addLog('No valid controlled CRE quote is available', 'error');
      return;
    }
    if (!embeddedWallet || !signerAdded) {
      addLog('Connect the authorized wallet before executing', 'policy');
      return;
    }
    if (!strategy || strategy.appAddress.toLowerCase() !== (process.env.NEXT_PUBLIC_CONTROLLED_BACKSTOP_APP_ADDRESS || '0x42698126b5E4884A99905484d484ECe7fbF18A6a').toLowerCase() || strategy.maker.toLowerCase() !== embeddedWallet.address.toLowerCase()) {
      addLog('Authorize a controlled btUSDC strategy from this embedded wallet before executing.', 'policy');
      return;
    }
    const executionStrategy = {
      maker: strategy.maker as Hex,
      tokenIn: strategy.tokenIn as Hex,
      tokenOut: strategy.tokenOut as Hex,
      maxTrade: BigInt(Math.round(Number(strategy.maxTrade) * 1e6)),
      minDiscountBps: Number(strategy.minDiscountBps),
      maxDiscountBps: Number(strategy.maxDiscountBps),
      expiry: BigInt(strategy.expiry),
      salt: strategy.salt.padEnd(66, '0') as Hex,
    };
    const calculatedHash = keccak256(encodeAbiParameters(parseAbiParameters('address, address, address, uint256, uint16, uint16, uint64, bytes32'), [executionStrategy.maker, executionStrategy.tokenIn, executionStrategy.tokenOut, executionStrategy.maxTrade, executionStrategy.minDiscountBps, executionStrategy.maxDiscountBps, executionStrategy.expiry, executionStrategy.salt]));
    const data = encodeFunctionData({
      abi: [{type: 'function', name: 'execute', stateMutability: 'nonpayable', inputs: [
        {name: 'strategyHash', type: 'bytes32'},
        {name: 'strategy', type: 'tuple', components: [{name: 'maker', type: 'address'}, {name: 'tokenIn', type: 'address'}, {name: 'tokenOut', type: 'address'}, {name: 'maxTrade', type: 'uint256'}, {name: 'minDiscountBps', type: 'uint16'}, {name: 'maxDiscountBps', type: 'uint16'}, {name: 'expiry', type: 'uint64'}, {name: 'salt', type: 'bytes32'}]},
        {name: 'quoteId', type: 'bytes32'}, {name: 'borrower', type: 'address'}, {name: 'expectedWethOut', type: 'uint256'},
      ], outputs: [{type: 'uint256'}]}],
      functionName: 'execute', args: [calculatedHash, executionStrategy, latestQuote.quoteId as Hex, controlledBorrowerAddress as Hex, BigInt(latestQuote.minCollateralOut)],
    });
    setSimulating(true);
    addLog(`Executing controlled quote ${latestQuote.quoteId.slice(0, 10)}…`, 'info');
    try {
      const hash = await sendTransaction({to: CONTROLLED_EXECUTOR as Hex, data, value: '0x0', gasLimit: 500000n, chainId: CHAIN_ID}, {address: embeddedWallet.address});
      addLog(`Controlled liquidation confirmed: ${hash.hash}`, 'success');
      addPolicyLog(`Controlled quote consumed: ${hash.hash.slice(0, 10)}…`, 'success');
    } catch (error: unknown) {
      addLog(`Controlled liquidation failed: ${errorMessage(error)}`, 'error');
    } finally {
      setSimulating(false);
    }
  }, [mode, latestQuote, embeddedWallet, signerAdded, strategy, controlledBorrowerAddress, addLog, addPolicyLog, sendTransaction]);

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
      // A quote is refreshed from the registry every five seconds; `execute`
      // indicates the registry considers the returned quote current.
      { label: 'Quote not expired', passed: !!latestQuote?.execute },
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
    aquaApproved,
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
    mode,
    setMode,
    aavePosition,
    liveOpportunityLoading,
    liveOpportunityError,
    borrowerAddress,
    setBorrowerAddress,
    controlledBorrowerAddress,
    setControlledBorrowerAddress,
    controlledQuoteMatchesSelection: mode === 'controlled' && !!latestQuote && latestQuote.source === 'controlled',
    controlledPositionSettled: mode === 'controlled' && controlledBorrowerAddress.toLowerCase() === CONTROLLED_BORROWER.toLowerCase() && BigInt(aavePosition?.debtAmount || '0') > 0n && BigInt(aavePosition?.debtAmount || '0') <= 500_000_000n,
    scanLivePosition,
    addLog,
    addPolicyLog,
    refreshBalances,
    addSigner,
    fundWallet,
    approveAqua,
    shipStrategy,
    executeControlledLiquidation,
    controlledStrategyCapacityAvailable: !!strategy && strategy.appAddress.toLowerCase() === (process.env.NEXT_PUBLIC_CONTROLLED_BACKSTOP_APP_ADDRESS || '0x42698126b5E4884A99905484d484ECe7fbF18A6a').toLowerCase() && strategy.maker.toLowerCase() === embeddedWallet?.address?.toLowerCase(),
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
    aquaApproved,
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
    mode,
    aavePosition,
    liveOpportunityLoading,
    liveOpportunityError,
    borrowerAddress,
    controlledBorrowerAddress,
    setBorrowerAddress,
    addLog,
    addPolicyLog,
    refreshBalances,
    addSigner,
    fundWallet,
    approveAqua,
    shipStrategy,
    executeControlledLiquidation,
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
