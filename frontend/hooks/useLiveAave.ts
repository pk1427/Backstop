'use client';

import {useCallback, useEffect, useState} from 'react';

// Aave V3 Sepolia addresses
const AAVE_POOL = process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS || '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';
const AAVE_ORACLE = process.env.NEXT_PUBLIC_AAVE_ORACLE_ADDRESS || '0x2da88497588bf89281816106C7259e31AF45a663';
const AAVE_POOL_DATA_PROVIDER = process.env.NEXT_PUBLIC_AAVE_POOL_DATA_PROVIDER_ADDRESS || '0x3e9708d80f7B3e43118013075F7e95CE3AB31F31';
const AAVE_WETH = process.env.NEXT_PUBLIC_AAVE_WETH_ADDRESS || '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c';
const AAVE_USDC = process.env.NEXT_PUBLIC_AAVE_USDC_ADDRESS || '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

export interface LiveAavePosition {
  borrower: string;
  healthFactor: number;
  collateralAsset: string;
  collateralAmount: string; // raw units
  collateralAmountFormatted: string; // human readable
  collateralUsd: number;
  debtAsset: string;
  debtAmount: string; // raw units
  debtAmountFormatted: string; // human readable
  debtUsd: number;
  liquidationThreshold: number; // bps
  liquidationBonus: number; // bps
  collateralDecimals: number;
  debtDecimals: number;
  maxLiquidatableDebt: string; // raw units
  maxLiquidatableDebtFormatted: string; // human readable
  expectedCollateral: string; // raw units
  expectedCollateralFormatted: string; // human readable
  eligible: boolean;
  eligibilityReason: string;
  isLive: boolean;
}

export interface LivePrices {
  wethPriceUsd8: number;
  usdcPriceUsd8: number;
  wethPriceFormatted: string;
  usdcPriceFormatted: string;
  timestamp: number;
}

export interface LiveOpportunity {
  position: LiveAavePosition;
  prices: LivePrices;
  discountBps: number;
  minCollateralOut: string;
  minCollateralOutFormatted: string;
  quoteExpiry: number;
  quoteExecute: boolean;
  source: 'live' | 'demo';
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

const POOL_DATA_PROVIDER_ABI = [
  'function getUserReserveData(address,address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)',
  'function getReserveConfigurationData(address) view returns (uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool)',
];

const POOL_ABI = [
  'function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
];

const ORACLE_ABI = [
  'function getAssetPrice(address) view returns (uint256)',
];

const SELECTORS = {
  getUserAccountData: '0xfa78107a',
  getUserReserveData: '0x28dd2d01',
  getReserveConfigurationData: '0x3e150141',
  getAssetPrice: '0xb3596f07',
} as const;

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function ethCall(to: string, data: string): Promise<string> {
  return (await rpcCall('eth_call', [{to, data}, 'latest'])) as string;
}

function decodeUint256(hex: string): bigint {
  return BigInt(hex.replace(/^0x/, '') || '0');
}

function formatUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

function formatUsd(value: bigint): number {
  // Aave returns USD with 18 decimals
  return Number(value) / 1e18;
}

function priceWeiToUsd8(priceWei: bigint): number {
  // Aave oracle returns price in WEI (18 decimals) for 1 unit of asset
  // Convert to 8 decimals USD
  return Number(priceWei) / 1e10;
}

export async function fetchLivePrices(): Promise<LivePrices> {
  const wethPriceHex = await ethCall(AAVE_ORACLE, SELECTORS.getAssetPrice + AAVE_WETH.slice(2).padStart(64, '0'));
  const usdcPriceHex = await ethCall(AAVE_ORACLE, SELECTORS.getAssetPrice + AAVE_USDC.slice(2).padStart(64, '0'));

  const wethPriceWei = decodeUint256(wethPriceHex);
  const usdcPriceWei = decodeUint256(usdcPriceHex);

  const wethPriceUsd8 = priceWeiToUsd8(wethPriceWei);
  const usdcPriceUsd8 = priceWeiToUsd8(usdcPriceWei);

  return {
    wethPriceUsd8,
    usdcPriceUsd8,
    wethPriceFormatted: '$' + wethPriceUsd8.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    usdcPriceFormatted: '$' + usdcPriceUsd8.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    timestamp: Date.now(),
  };
}

export async function fetchLiveAavePosition(borrower: string): Promise<LiveAavePosition> {
  const accountDataHex = await ethCall(AAVE_POOL, SELECTORS.getUserAccountData + borrower.slice(2).padStart(64, '0'));
  
  const accountData = abiDecode(accountDataHex, [
    'uint256', // totalCollateralUsd
    'uint256', // totalDebtUsd
    'uint256', // availableBorrowsUsd
    'uint256', // currentLiquidationThreshold
    'uint256', // ltv
    'uint256', // healthFactor
  ]);

  const totalCollateralUsd = accountData[0];
  const totalDebtUsd = accountData[1];
  const healthFactor = accountData[5];

  const wethReserveDataHex = await ethCall(
    AAVE_POOL_DATA_PROVIDER,
    SELECTORS.getUserReserveData + borrower.slice(2).padStart(64, '0') + AAVE_WETH.slice(2).padStart(64, '0')
  );
  
  const wethReserveData = abiDecode(wethReserveDataHex, [
    'uint256', // currentATokenBalance
    'uint256', // currentStableDebt
    'uint256', // currentVariableDebt
    'uint256', // principalStableDebt
    'uint256', // scaledVariableDebt
    'uint256', // stableBorrowRate
    'uint256', // liquidityRate
    'uint256', // stableRateLastUpdated
    'bool',    // usageAsCollateralEnabled
  ]);

  const collateralAmount = wethReserveData[0];

  const usdcReserveDataHex = await ethCall(
    AAVE_POOL_DATA_PROVIDER,
    SELECTORS.getUserReserveData + borrower.slice(2).padStart(64, '0') + AAVE_USDC.slice(2).padStart(64, '0')
  );
  
  const usdcReserveData = abiDecode(usdcReserveDataHex, [
    'uint256', // currentATokenBalance
    'uint256', // currentStableDebt
    'uint256', // currentVariableDebt
    'uint256', // principalStableDebt
    'uint256', // scaledVariableDebt
    'uint256', // stableBorrowRate
    'uint256', // liquidityRate
    'uint256', // stableRateLastUpdated
    'bool',    // usageAsCollateralEnabled
  ]);

  const debtAmount = usdcReserveData[1] + usdcReserveData[2]; // stable + variable debt

  const wethConfigHex = await ethCall(
    AAVE_POOL_DATA_PROVIDER,
    SELECTORS.getReserveConfigurationData + AAVE_WETH.slice(2).padStart(64, '0')
  );
  
  const wethConfig = abiDecode(wethConfigHex, [
    'uint256', // decimals
    'uint256', // ltv
    'uint256', // liquidationThreshold
    'uint256', // liquidationBonus
    'uint256', // reserveFactor
    'bool',    // usageAsCollateralEnabled
    'bool',    // borrowingEnabled
    'bool',    // stableBorrowRateEnabled
    'bool',    // isActive
    'bool',    // isFrozen
  ]);

  const usdcConfigHex = await ethCall(
    AAVE_POOL_DATA_PROVIDER,
    SELECTORS.getReserveConfigurationData + AAVE_USDC.slice(2).padStart(64, '0')
  );
  
  const usdcConfig = abiDecode(usdcConfigHex, [
    'uint256', // decimals
    'uint256', // ltv
    'uint256', // liquidationThreshold
    'uint256', // liquidationBonus
    'uint256', // reserveFactor
    'bool',    // usageAsCollateralEnabled
    'bool',    // borrowingEnabled
    'bool',    // stableBorrowRateEnabled
    'bool',    // isActive
    'bool',    // isFrozen
  ]);

  const liquidationThreshold = Number(wethConfig[2]);
  const liquidationBonus = Number(wethConfig[3]);
  const wethIsActive = wethConfig[8];
  const wethIsFrozen = wethConfig[9];
  const wethUsageAsCollateral = wethConfig[5];
  const usdcIsActive = usdcConfig[8];
  const usdcIsFrozen = usdcConfig[9];
  const usdcBorrowingEnabled = usdcConfig[6];

  // Get prices
  const prices = await fetchLivePrices();

  // Calculate max liquidatable debt (50% close factor)
  const maxLiquidatableDebt = (BigInt(debtAmount.toString()) * 5000n) / 10000n;

  // Calculate expected collateral using liquidation bonus
  // expectedCollateral = debtToCover * debtPrice * 10^collateralDecimals * liquidationBonus / (10^debtDecimals * collateralPrice * 10000)
  const expectedCollateral = (maxLiquidatableDebt * BigInt(Math.round(prices.usdcPriceUsd8 * 1e8)) * 10n**18n * BigInt(liquidationBonus)) / 
    (10n**6n * BigInt(Math.round(prices.wethPriceUsd8 * 1e8)) * 10000n);

  // Check eligibility
  let eligible = true;
  let eligibilityReason = '';

  if (healthFactor === 0n) {
    eligible = false;
    eligibilityReason = 'No debt position';
  } else if (healthFactor >= 10n**18n) {
    eligible = false;
    eligibilityReason = 'Health factor >= 1';
  } else if (debtAmount === 0n) {
    eligible = false;
    eligibilityReason = 'No debt';
  } else if (collateralAmount === 0n) {
    eligible = false;
    eligibilityReason = 'No collateral';
  } else if (!wethIsActive || wethIsFrozen) {
    eligible = false;
    eligibilityReason = 'WETH reserve not active or frozen';
  } else if (!wethUsageAsCollateral) {
    eligible = false;
    eligibilityReason = 'WETH collateral usage disabled';
  } else if (!usdcIsActive || usdcIsFrozen) {
    eligible = false;
    eligibilityReason = 'USDC reserve not active or frozen';
  } else if (!usdcBorrowingEnabled) {
    eligible = false;
    eligibilityReason = 'USDC borrowing disabled';
  } else if (maxLiquidatableDebt === 0n) {
    eligible = false;
    eligibilityReason = 'No liquidatable debt available';
  }

  return {
    borrower,
    healthFactor: Number(healthFactor) / 1e18,
    collateralAsset: AAVE_WETH,
    collateralAmount: collateralAmount.toString(),
    collateralAmountFormatted: formatUnits(collateralAmount, 18),
    collateralUsd: formatUsd(totalCollateralUsd),
    debtAsset: AAVE_USDC,
    debtAmount: debtAmount.toString(),
    debtAmountFormatted: formatUnits(debtAmount, 6),
    debtUsd: formatUsd(totalDebtUsd),
    liquidationThreshold,
    liquidationBonus,
    collateralDecimals: 18,
    debtDecimals: 6,
    maxLiquidatableDebt: maxLiquidatableDebt.toString(),
    maxLiquidatableDebtFormatted: formatUnits(maxLiquidatableDebt, 6),
    expectedCollateral: expectedCollateral.toString(),
    expectedCollateralFormatted: formatUnits(expectedCollateral, 18),
    eligible,
    eligibilityReason,
    isLive: true,
  };
}

function abiDecode(hex: string, types: string[]): bigint[] {
  const data = hex.replace(/^0x/, '');
  const results: bigint[] = [];
  let offset = 0;
  
  for (const type of types) {
    if (type === 'uint256') {
      const value = BigInt('0x' + data.slice(offset, offset + 64));
      results.push(value);
      offset += 64;
    } else if (type === 'bool') {
      const value = BigInt('0x' + data.slice(offset, offset + 64)) !== 0n ? 1n : 0n;
      results.push(value);
      offset += 64;
    }
  }
  
  return results;
}

export function useLiveAavePosition(borrower: string | null, enabled: boolean = true) {
  const [position, setPosition] = useState<LiveAavePosition | null>(null);
  const [prices, setPrices] = useState<LivePrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!borrower || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [positionData, pricesData] = await Promise.all([
        fetchLiveAavePosition(borrower),
        fetchLivePrices(),
      ]);
      setPosition(positionData);
      setPrices(pricesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch position');
    } finally {
      setLoading(false);
    }
  }, [borrower, enabled]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetch]);

  return {position, prices, loading, error, refetch: fetch};
}

export function buildLiveOpportunity(
  position: LiveAavePosition,
  prices: LivePrices,
  discountBps: number,
  quoteTtlSeconds: number = 3600
): LiveOpportunity {
  // Calculate minCollateralOut from quote discount (maker's price)
  // minCollateralOut = debtAmount * debtPrice * 10^collateralDecimals * 10000 / (10^debtDecimals * collateralPrice * (10000 - discountBps))
  const debtAmount = BigInt(position.maxLiquidatableDebt);
  const minCollateralOut = (debtAmount * BigInt(Math.round(prices.usdcPriceUsd8 * 1e8)) * 10n**18n * 10000n) /
    (10n**6n * BigInt(Math.round(prices.wethPriceUsd8 * 1e8)) * (10000n - BigInt(discountBps)));

  return {
    position,
    prices,
    discountBps,
    minCollateralOut: minCollateralOut.toString(),
    minCollateralOutFormatted: formatUnits(minCollateralOut, 18),
    quoteExpiry: Math.floor(Date.now() / 1000) + quoteTtlSeconds,
    quoteExecute: true,
    source: 'live',
  };
}

// Demo/fallback data for when live fetch fails
export const DEMO_OPPORTUNITY: LiveOpportunity = {
  position: {
    borrower: '0x0000000000000000000000000000000000000000',
    healthFactor: 0.85,
    collateralAsset: AAVE_WETH,
    collateralAmount: '1200000000000000000',
    collateralAmountFormatted: '1.20',
    collateralUsd: 4105,
    debtAsset: AAVE_USDC,
    debtAmount: '2000000000',
    debtAmountFormatted: '2,000',
    debtUsd: 2000,
    liquidationThreshold: 8500,
    liquidationBonus: 10500,
    collateralDecimals: 18,
    debtDecimals: 6,
    maxLiquidatableDebt: '1000000000',
    maxLiquidatableDebtFormatted: '1,000',
    expectedCollateral: '308000000000000000',
    expectedCollateralFormatted: '0.308',
    eligible: true,
    eligibilityReason: '',
    isLive: false,
  },
  prices: {
    wethPriceUsd8: 342100000000,
    usdcPriceUsd8: 100000000,
    wethPriceFormatted: '$3,421.00',
    usdcPriceFormatted: '$1.00',
    timestamp: Date.now(),
  },
  discountBps: 200,
  minCollateralOut: '302000000000000000',
  minCollateralOutFormatted: '0.302',
  quoteExpiry: Math.floor(Date.now() / 1000) + 3600,
  quoteExecute: true,
  source: 'demo',
};