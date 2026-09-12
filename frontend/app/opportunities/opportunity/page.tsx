'use client';

import Link from 'next/link';
import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation} from '@/components';

export default function OpportunityDetailPage() {
  const backstop = useBackstop();
  const quote = backstop.latestQuote;
  const isControlled = backstop.mode === 'controlled';
  const borrower = backstop.aavePosition?.borrower || '—';
  const requestedCapital = quote?.liquidationSizeUsd.toFixed(2) || '500.00';
  const debt = backstop.aavePosition?.debtAmountFormatted || '—';
  const collateral = backstop.aavePosition?.collateralAmountFormatted || '—';
  const health = backstop.aavePosition?.healthFactor || quote?.healthFactor || 0;
  const discount = quote ? `${quote.discountBps} bps` : '150 bps';

  return <div className="protocol-surface flex min-h-screen flex-col bg-[#030816]">
    <Header systemStatus={backstop.systemStatus} statusLabel={backstop.statusLabel} walletAddress={backstop.embeddedWallet?.address} network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`} onLogout={backstop.logout} />
    <Navigation items={[{label: 'Dashboard', href: '/overview'}, {label: 'Strategy', href: '/strategy'}, {label: 'Liquidations', href: '/opportunities', active: true}, {label: 'Activity', href: '/activity'}]} />
    <main className="flex-1"><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/opportunities" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">← All liquidations</Link>
      <div className="mt-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.16em] text-emerald-600 dark:text-emerald-400">LIQUIDATION OPPORTUNITY</p><h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">ETH / USDC</h1></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${health < 1 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{health < 1 ? 'LIQUIDATABLE' : 'AT RISK'}</span></div>
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><dl className="grid grid-cols-2 gap-5 text-sm"><Fact label="Borrower" value={`${borrower.slice(0, 6)}...${borrower.slice(-4)}`} mono /><Fact label="Health factor" value={health.toFixed(3)} /><Fact label="Collateral" value={`${collateral} ${isControlled ? 'btWETH' : 'WETH'}`} /><Fact label="Debt" value={`${debt} ${isControlled ? 'btUSDC' : 'USDC'}`} /></dl></section>
      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-xs font-semibold tracking-widest text-zinc-500">BACKSTOP QUOTE</p><dl className="mt-4 grid grid-cols-2 gap-5 text-sm"><Fact label="Capital requested" value={`${requestedCapital} ${isControlled ? 'btUSDC' : 'USDC'}`} /><Fact label="Discount" value={discount} /><Fact label="Asset pair" value={isControlled ? 'btUSDC → btWETH' : 'USDC → WETH'} /><Fact label="Quote status" value={quote ? 'Valid · ~60 minutes' : 'Waiting for quote'} /></dl></section>
      {isControlled ? <ControlledActions backstop={backstop} quoteReady={Boolean(quote?.execute)} /> : <p className="mt-6 rounded-lg border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm text-slate-400">Select the controlled market to review the verified end-to-end settlement.</p>}
    </div></main>
  </div>;
}

function Fact({label, value, mono = false}: {label: string; value: string; mono?: boolean}) { return <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt><dd className={`mt-1 font-medium text-zinc-900 dark:text-zinc-100 ${mono ? 'font-mono' : ''}`}>{value}</dd></div>; }

function ControlledActions({backstop, quoteReady}: {backstop: ReturnType<typeof useBackstop>; quoteReady: boolean}) {
  if (backstop.controlledPositionSettled) return <section className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-5"><p className="text-xs font-semibold tracking-widest text-emerald-300">SETTLEMENT CONFIRMED</p><p className="mt-2 text-sm text-slate-200">500 btUSDC was repaid and 0.3500 btWETH was delivered to the Privy maker. The CRE quote has been consumed onchain.</p><a href="https://sepolia.etherscan.io/tx/0xfb8b9e3e545fca0eb35f9c00166fbad4ecfec4842730cf39cbcf04b33f79f272" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-semibold text-cyan-300">View confirmed settlement ↗</a></section>;
  if (!backstop.controlledQuoteMatchesSelection) return <section className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5"><p className="text-xs font-semibold tracking-widest text-amber-300">NO EXECUTION QUOTE</p><p className="mt-2 text-sm text-slate-300">This borrower is available for inspection only. Return to the market and select Position 02 to use the active CRE quote.</p><Link href="/opportunities" className="mt-4 inline-flex text-sm font-semibold text-cyan-300">Back to controlled positions →</Link></section>;
  const strategyReady = backstop.controlledStrategyCapacityAvailable;
  return <section className="mt-5 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5"><p className="text-xs font-semibold tracking-widest text-cyan-300">CONTROLLED EXECUTION</p><p className="mt-2 text-sm text-slate-300">Your Privy wallet holds 1,000 btUSDC. Authorize a maximum of 500 btUSDC, then execute only the signed CRE quote.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><ActionStep number="1" label="Approve btUSDC" complete={backstop.aquaApproved} /><ActionStep number="2" label="Ship strategy" complete={strategyReady} /><ActionStep number="3" label="Execute quote" complete={false} /></div><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => backstop.approveAqua()} disabled={!backstop.signerAdded || backstop.aquaApproved} className="rounded-lg border border-[#365275] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-45">{backstop.aquaApproved ? 'btUSDC approved ✓' : 'Approve btUSDC'}</button><button onClick={() => backstop.shipStrategy({maxTrade: '500', minDiscountBps: '100', maxDiscountBps: '300', durationHours: '24'})} disabled={!backstop.aquaApproved || strategyReady} className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45">{strategyReady ? 'Strategy authorized ✓' : 'Authorize 500 btUSDC'}</button><button onClick={backstop.executeControlledLiquidation} disabled={!quoteReady || !strategyReady || backstop.simulating} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">{backstop.simulating ? 'Executing…' : 'Execute controlled liquidation'}</button></div>{!backstop.signerAdded && <p className="mt-3 text-xs text-amber-300">Preparing the Privy scoped signer…</p>}</section>;
}

function ActionStep({number, label, complete}: {number: string; label: string; complete: boolean}) { return <div className={`rounded-lg border px-3 py-3 text-sm ${complete ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-[#29405f] bg-[#071023] text-slate-300'}`}><span className="mr-2 text-xs font-semibold">{complete ? '✓' : number}</span>{label}</div>; }
