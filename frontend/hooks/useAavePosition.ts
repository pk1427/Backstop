'use client';

import {useCallback, useEffect, useState} from 'react';

export const BASE_SEPOLIA = 84532;
export const AAVE_POOL = '0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27';
export const AAVE_ORACLE = '0x943b0dE18d4abf4eF02A85912F8fc07684C141dF';
export const WETH = '0x4200000000000000000000000000000000000006';
export const USDC = '0xba50cd2a20f6da35d788639e581bca8d0b5d4d5f';
export const AWETH = '0x73a5bB60b0B0fc35710DDc0ea9c407031E31Bdbb';
export const VARIABLE_DEBT_USDC = '0xFB3e85601b7fEb3691bbb8779Ef0E1069E347204';
const RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const RAY = 10n ** 18n;

export type PositionStatus = 'HEALTHY' | 'AT_RISK' | 'LIQUIDATABLE' | 'EMPTY';
export interface AavePosition {
  address: string; chainId: number; collateralAmount: bigint; debtAmount: bigint;
  collateralBase: bigint; debtBase: bigint; availableBorrowsBase: bigint;
  liquidationThreshold: bigint; ltv: bigint; healthFactor: bigint;
  currentCollateralPrice: bigint; currentDebtPrice: bigint; liquidationPrice: bigint;
  status: PositionStatus; lastUpdatedBlock: bigint; lastUpdatedAt: number;
}

const pad = (value: string) => value.replace(/^0x/, '').padStart(64, '0');
const callData = (selector: string, ...args: string[]) => selector + args.map(pad).join('');
const uint = (hex: string, index = 0) => BigInt('0x' + hex.slice(2 + index * 64, 2 + (index + 1) * 64));
export const formatUnits = (value: bigint, decimals: number, precision = 6) => {
  const base = 10n ** BigInt(decimals); const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
};
export const formatRatio = (value: bigint, precision = 4) => formatUnits(value, 18, precision);

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(RPC, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: Date.now(), method, params})});
  const payload = await response.json(); if (payload.error) throw new Error(payload.error.message); return payload.result as string;
}
async function ethCall(to: string, data: string) { return rpc('eth_call', [{to, data}, 'latest']); }

export async function fetchAavePosition(address: string): Promise<AavePosition> {
  const [account, collateral, debt, wethPrice, usdcPrice, block] = await Promise.all([
    ethCall(AAVE_POOL, callData('0xbf92857c', address)),
    ethCall(AWETH, callData('0x70a08231', address)), ethCall(VARIABLE_DEBT_USDC, callData('0x70a08231', address)),
    ethCall(AAVE_ORACLE, callData('0xb3596f07', WETH)), ethCall(AAVE_ORACLE, callData('0xb3596f07', USDC)), rpc('eth_blockNumber', []),
  ]);
  const healthFactor = uint(account, 5); const collateralAmount = uint(collateral); const debtAmount = uint(debt);
  const liquidationThreshold = uint(account, 3); const status: PositionStatus = debtAmount === 0n ? 'EMPTY' : healthFactor < RAY ? 'LIQUIDATABLE' : healthFactor < 1100000000000000000n ? 'AT_RISK' : 'HEALTHY';
  // (debt base / threshold) / collateral WETH, preserving Aave's 8-decimal USD price scale.
  const liquidationPrice = collateralAmount === 0n || uint(account, 1) === 0n ? 0n : (uint(account, 1) * 10000n * 10n ** 18n) / (liquidationThreshold * collateralAmount);
  return {address, chainId: BASE_SEPOLIA, collateralAmount, debtAmount, collateralBase: uint(account), debtBase: uint(account, 1), availableBorrowsBase: uint(account, 2), liquidationThreshold, ltv: uint(account, 4), healthFactor, currentCollateralPrice: uint(wethPrice), currentDebtPrice: uint(usdcPrice), liquidationPrice, status, lastUpdatedBlock: BigInt(block), lastUpdatedAt: Date.now()};
}

export function useAavePosition(address?: string) {
  const [position, setPosition] = useState<AavePosition | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { if (!address) { setPosition(null); return; } setLoading(true); try { setPosition(await fetchAavePosition(address)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Could not read Aave position'); } finally { setLoading(false); } }, [address]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  return {position, loading, error, refresh};
}

export const selectors: Record<'deposit' | 'approve' | 'supply' | 'borrow' | 'withdraw', `0x${string}`> = {deposit: '0xd0e30db0', approve: '0x095ea7b3', supply: '0x617ba037', borrow: '0xa415bcad', withdraw: '0x69328dec'};
export const encode = {approve: (spender: string, amount: bigint) => callData(selectors.approve, spender, '0x' + amount.toString(16)) as `0x${string}`, supply: (amount: bigint, user: string) => callData(selectors.supply, WETH, '0x' + amount.toString(16), user, '0x0') as `0x${string}`, borrow: (amount: bigint, user: string) => callData(selectors.borrow, USDC, '0x' + amount.toString(16), '0x2', '0x0', user) as `0x${string}`, withdraw: (amount: bigint, user: string) => callData(selectors.withdraw, WETH, '0x' + amount.toString(16), user) as `0x${string}`};
