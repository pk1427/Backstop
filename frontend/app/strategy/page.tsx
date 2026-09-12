'use client';

import {useState} from 'react';
import {useBackstop, StrategyInput} from '@/hooks/useBackstop';
import {Header, Navigation, StrategyCard} from '@/components';

const defaults: StrategyInput = {maxTrade: '500', minDiscountBps: '100', maxDiscountBps: '300', durationHours: '24'};

export default function StrategyPage() {
  const backstop = useBackstop();
  const controlled = backstop.mode === 'controlled';
  const capitalAsset = controlled ? 'btUSDC' : 'USDC';
  const [form, setForm] = useState<StrategyInput>(defaults);
  const update = (key: keyof StrategyInput, value: string) => setForm((current) => ({...current, [key]: value}));

  return <div className="protocol-surface flex min-h-screen flex-col bg-[#030816]">
    <Header systemStatus={backstop.systemStatus} statusLabel={backstop.statusLabel} walletAddress={backstop.embeddedWallet?.address} network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`} onLogout={backstop.logout} />
    <Navigation items={[{label: 'Dashboard', href: '/overview'}, {label: 'Strategy', href: '/strategy', active: true}, {label: 'Liquidations', href: '/opportunities'}, {label: 'Activity', href: '/activity'}]} />
    <main className="flex-1"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {!backstop.authenticated ? <Connect onClick={backstop.login} /> : <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.16em] text-cyan-300">{controlled ? 'CONTROLLED MARKET MAKER' : 'LIVE AAVE MAKER'}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{backstop.strategy ? 'Manage strategy' : 'Create strategy'}</h1><p className="mt-2 text-sm text-zinc-500">{controlled ? 'Authorize btUSDC from this Privy wallet for controlled CRE settlements.' : 'Set the exact boundaries for real Aave liquidation liquidity.'}</p></div><div className="flex rounded-xl border border-[#29405f] bg-[#071023] p-1"><button onClick={() => backstop.setMode('controlled')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${controlled ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-500'}`}>CONTROLLED</button><button onClick={() => backstop.setMode('live')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${!controlled ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-500'}`}>LIVE AAVE</button></div></div>
        {backstop.strategy && <StrategyCard strategy={backstop.strategy} />}
        <section className="rounded-2xl border border-[#243a5a] bg-[#071023]/80 p-6 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.14em] text-cyan-300">STRATEGY POLICY</p><p className="mt-2 text-sm text-zinc-500">Capital stays self-custodied until an execution satisfies these rules.</p></div><div className="flex gap-4 text-sm font-medium"><button onClick={() => setForm({maxTrade: '', minDiscountBps: '', maxDiscountBps: '', durationHours: ''})} className="text-slate-400 hover:text-white">Clear</button><button onClick={() => setForm(defaults)} className="text-cyan-300 hover:text-cyan-200">Reset defaults</button></div></div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Maximum capital per execution" suffix={capitalAsset} value={form.maxTrade} onChange={(value) => update('maxTrade', value)} /><Field label="Minimum discount" suffix="bps" value={form.minDiscountBps} onChange={(value) => update('minDiscountBps', value)} /><Field label="Maximum discount" suffix="bps" value={form.maxDiscountBps} onChange={(value) => update('maxDiscountBps', value)} /><Field label="Strategy expiry" suffix="hours" value={form.durationHours} onChange={(value) => update('durationHours', value)} /></div>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[#243a5a] pt-5"><p className="text-sm text-slate-400">{controlled ? 'btUSDC → btWETH · controlled Aqua authorization' : 'USDC → WETH · Aqua authorization'}</p><div className="flex gap-3"><button onClick={() => backstop.approveAqua()} className="rounded-xl border border-[#365275] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400/50 disabled:opacity-50" disabled={!backstop.signerAdded || backstop.aquaApproved}>{backstop.aquaApproved ? `${capitalAsset} approved ✓` : `Approve ${capitalAsset}`}</button><button onClick={() => backstop.shipStrategy(form)} disabled={!backstop.signerAdded || !backstop.aquaApproved} className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-40">{controlled ? `Create ${capitalAsset} strategy` : backstop.strategy ? 'Update strategy' : 'Ship strategy'}</button></div></div>
        </section>
      </div>}
    </div></main>
  </div>;
}

function Field({label, suffix, value, onChange}: {label: string; suffix: string; value: string; onChange: (value: string) => void}) { return <label className="block"><span className="text-sm font-medium text-slate-300">{label}</span><span className="mt-2 flex overflow-hidden rounded-xl border border-[#2a4265] bg-[#030816] focus-within:border-cyan-400/60"><input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base font-semibold text-white outline-none" /><span className="border-l border-[#2a4265] px-3 py-3 text-sm text-slate-500">{suffix}</span></span></label>; }
function Connect({onClick}: {onClick: () => void}) { return <div className="flex flex-col items-center justify-center py-24 text-center"><h2 className="text-xl font-semibold">Connect to manage your strategy</h2><button onClick={onClick} className="mt-6 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300">Connect wallet</button></div>; }
