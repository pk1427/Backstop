'use client';

import Link from 'next/link';
import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, OpportunityCard} from '@/components';

const TEST_POSITIONS = [
  {address: '0x76cd707D25685Dc7956Ed5d4e41D086845A1fB92', label: 'Position 01', health: '1.65', collateral: '0.010 WETH', debt: '20 USDC', status: 'Healthy'},
  {address: '0x85D737640a6b86EBfd1AcEB9BE9992c90020bA1c', label: 'Position 02', health: '2.06', collateral: '0.010 WETH', debt: '32 USDC', status: 'Healthy'},
  {address: '0xf62c155Eb012303Cbba80cb246De20E05dd57051', label: 'Position 03', health: '1.06', collateral: '0.004 WETH', debt: '12.5 USDC', status: 'Near threshold'},
  {address: '0x0Bc87b3FBbCBEb04595A503fbCe1d627cEd222ad', label: 'Position 04', health: '3.30', collateral: '0.004 WETH', debt: '8 USDC', status: 'Healthy'},
];

export default function OpportunitiesPage() {
  const backstop = useBackstop();

  return (
    <div className="protocol-surface flex min-h-screen flex-col bg-[#030816]">
      <Header
        systemStatus={backstop.systemStatus}
        statusLabel={backstop.statusLabel}
        walletAddress={backstop.embeddedWallet?.address}
        network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`}
        onLogout={backstop.logout}
      />
      <Navigation items={[
        {label: 'Dashboard', href: '/overview', active: false},
        {label: 'Strategy', href: '/strategy', active: false},
        {label: 'Liquidations', href: '/opportunities', active: true},
        {label: 'Activity', href: '/activity', active: false},
      ]} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          {!backstop.authenticated ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-white dark:text-zinc-900">B</span>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Connect to view opportunities</h2>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[.16em] text-cyan-300">LIQUIDATION MODE</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Liquidation market</h1>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {backstop.mode === 'live' ? 'Live Aave V3 Sepolia positions' : 'Simulated demo opportunity'}
                  </p>
                </div>
                <div className="flex rounded-xl border border-[#29405f] bg-[#071023] p-1">
                  <button
                    onClick={() => backstop.setMode('demo')}
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      backstop.mode === 'demo'
                        ? 'bg-cyan-400/15 text-cyan-300'
                        : 'text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    DEMO
                  </button>
                  <button
                    onClick={() => backstop.setMode('live')}
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      backstop.mode === 'live'
                        ? 'bg-cyan-400/15 text-cyan-300'
                        : 'text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    LIVE
                  </button>
                </div>
              </div>

              {backstop.mode === 'live' && <section><div className="mb-4"><p className="text-xs font-semibold tracking-[.14em] text-cyan-300">LIVE AAVE POSITIONS</p><p className="mt-2 text-sm text-slate-400">Select a borrower to load its onchain Aave V3 Sepolia position.</p></div><div className="grid gap-4 md:grid-cols-2">{TEST_POSITIONS.map((position) => <PositionCard key={position.address} position={position} active={backstop.borrowerAddress.toLowerCase() === position.address.toLowerCase()} onSelect={() => backstop.setBorrowerAddress(position.address)} />)}</div></section>}

              {backstop.mode === 'live' ? <LivePosition position={backstop.aavePosition} loading={backstop.liveOpportunityLoading} /> : <><OpportunityCard quote={backstop.latestQuote} loading={backstop.quoteLoading} /><div className="flex justify-end"><Link href="/opportunities/opportunity" className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20">Review opportunity →</Link></div></>}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function LivePosition({position, loading}: {position: ReturnType<typeof useBackstop>['aavePosition']; loading: boolean}) { if (loading) return <div className="protocol-card rounded-2xl p-6 text-sm text-slate-400">Reading Aave position…</div>; if (!position) return <div className="protocol-card rounded-2xl p-6 text-sm text-slate-400">Enter a borrower address to inspect its Aave position.</div>; const liquidatable = position.healthFactor < 1; return <section className="protocol-card rounded-2xl p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.14em] text-cyan-300">LIVE AAVE POSITION</p><p className="mt-2 text-lg font-semibold text-white">WETH collateral · USDC debt</p><p className="mt-1 text-sm text-slate-400">{position.borrower.slice(0, 6)}…{position.borrower.slice(-4)} · Ethereum Sepolia</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${liquidatable ? 'bg-red-400/10 text-red-300' : 'bg-cyan-400/10 text-cyan-300'}`}>{liquidatable ? 'LIQUIDATABLE' : 'MONITORED'}</span></div><div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#243a5a] pt-5"><Metric label="Health factor" value={position.healthFactor.toFixed(3)} /><Metric label="Collateral" value={`${position.collateralAmountFormatted} WETH`} /><Metric label="Debt" value={`${position.debtAmountFormatted} USDC`} /></div>{!liquidatable && <p className="mt-5 text-sm text-slate-400">This position is healthy. Backstop will only create an execution quote if its health factor drops below 1.</p>}</section>; }
function Metric({label, value}: {label: string; value: string}) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>; }

function PositionCard({position, active, onSelect}: {position: typeof TEST_POSITIONS[number]; active: boolean; onSelect: () => void}) { return <article className={`protocol-card rounded-2xl border p-5 transition ${active ? 'border-cyan-400/60 bg-cyan-400/5' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{position.label}</p><p className={`mt-1 text-xs font-semibold ${position.status === 'Near threshold' ? 'text-amber-300' : 'text-cyan-300'}`}>{position.status}</p></div><p className="text-2xl font-semibold text-white">{position.health}</p></div><p className="mt-4 font-mono text-xs text-slate-400">{position.address.slice(0, 10)}…{position.address.slice(-8)}</p><div className="mt-4 grid grid-cols-2 border-y border-[#243a5a] py-3 text-sm"><div><p className="text-xs text-slate-500">Collateral</p><p className="mt-1 text-slate-200">{position.collateral}</p></div><div><p className="text-xs text-slate-500">Debt</p><p className="mt-1 text-slate-200">{position.debt}</p></div></div><div className="mt-4 flex items-center justify-between"><button onClick={onSelect} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">{active ? 'Selected' : 'View position'} →</button><a href={`https://sepolia.etherscan.io/address/${position.address}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-400 hover:text-white">Explorer ↗</a></div></article>; }
