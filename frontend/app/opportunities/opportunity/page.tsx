'use client';

import Link from 'next/link';
import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation} from '@/components';

export default function OpportunityDetailPage() {
  const backstop = useBackstop();
  const quote = backstop.latestQuote;
  const borrower = backstop.aavePosition?.borrower || '0x81...91';
  const requestedCapital = quote?.liquidationSizeUsd.toFixed(2) || '500.00';
  const debt = backstop.aavePosition?.debtAmountFormatted || '8,200.00';
  const collateral = backstop.aavePosition?.collateralAmountFormatted || '0.050';
  const health = backstop.aavePosition?.healthFactor || quote?.healthFactor || 0.982;
  const discount = quote ? `${quote.discountBps} bps` : '150 bps';

  return <div className="protocol-surface flex min-h-screen flex-col bg-[#030816]">
    <Header systemStatus={backstop.systemStatus} statusLabel={backstop.statusLabel} walletAddress={backstop.embeddedWallet?.address} network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`} onLogout={backstop.logout} />
    <Navigation items={[{label: 'Dashboard', href: '/overview'}, {label: 'Strategy', href: '/strategy'}, {label: 'Liquidations', href: '/opportunities', active: true}, {label: 'Activity', href: '/activity'}]} />
    <main className="flex-1"><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/opportunities" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">← All liquidations</Link>
      <div className="mt-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.16em] text-emerald-600 dark:text-emerald-400">LIQUIDATION OPPORTUNITY</p><h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">ETH / USDC</h1></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${health < 1 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{health < 1 ? 'LIQUIDATABLE' : 'AT RISK'}</span></div>
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><dl className="grid grid-cols-2 gap-5 text-sm"><Fact label="Borrower" value={`${borrower.slice(0, 6)}...${borrower.slice(-4)}`} mono /><Fact label="Health factor" value={health.toFixed(3)} /><Fact label="Collateral" value={`${collateral} WETH`} /><Fact label="Debt" value={`${debt} USDC`} /></dl></section>
      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-xs font-semibold tracking-widest text-zinc-500">BACKSTOP QUOTE</p><dl className="mt-4 grid grid-cols-2 gap-5 text-sm"><Fact label="Capital requested" value={`${requestedCapital} USDC`} /><Fact label="Discount" value={discount} /><Fact label="Asset pair" value="USDC → WETH" /><Fact label="Quote status" value={quote ? 'Valid · ~60 minutes' : 'Waiting for quote'} /></dl></section>
      <section className={`mt-5 rounded-xl border p-5 ${backstop.policyOverallPassed ? 'border-cyan-400/30 bg-cyan-400/5' : 'border-amber-400/30 bg-amber-400/5'}`}><p className={`text-xs font-semibold tracking-widest ${backstop.policyOverallPassed ? 'text-cyan-300' : 'text-amber-300'}`}>{backstop.policyOverallPassed ? 'READY TO EXECUTE' : 'ACTION REQUIRED'}</p><p className="mt-2 text-sm text-zinc-300">{backstop.policyOverallPassed ? 'Quote, strategy, and Aqua authorization match. The execution will use only your authorized capital.' : 'This opportunity is outside the current strategy or needs Aqua authorization.'}</p></section>
      <button onClick={backstop.simulateSwap} disabled={!backstop.strategy || !quote || !backstop.policyOverallPassed || backstop.simulating || health >= 1} className="mt-6 w-full rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">{backstop.simulating ? 'Executing liquidation…' : 'Execute liquidation'}</button>
      {backstop.executionResult && <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm dark:border-emerald-900 dark:bg-emerald-950/30"><p className="font-semibold text-emerald-700 dark:text-emerald-300">LIQUIDATION COMPLETE</p><p className="mt-2">{backstop.executionResult.usdcDeployed} USDC deployed · {backstop.executionResult.wethPushed} WETH settled</p><p className="mt-1 break-all font-mono text-xs text-zinc-500">Tx: {backstop.executionResult.txHash}</p></section>}
    </div></main>
  </div>;
}

function Fact({label, value, mono = false}: {label: string; value: string; mono?: boolean}) { return <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt><dd className={`mt-1 font-medium text-zinc-900 dark:text-zinc-100 ${mono ? 'font-mono' : ''}`}>{value}</dd></div>; }
