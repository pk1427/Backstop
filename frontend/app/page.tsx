"use client";

import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useBackstop} from '@/hooks/useBackstop';

export default function Home() {
  const backstop = useBackstop();
  const router = useRouter();
  const launch = () => backstop.authenticated ? router.push('/overview') : backstop.login();

  return (
    <main className="protocol-surface min-h-screen overflow-hidden bg-[#030816] text-white selection:bg-cyan-300 selection:text-zinc-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3"><span className="grid h-9 w-9 place-items-center text-xl text-violet-400 [text-shadow:0_0_16px_rgba(139,92,246,.8)]">✦</span><span className="text-xl font-bold tracking-[.23em] text-white">BACKSTOP</span></Link>
        <button onClick={launch} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium hover:border-zinc-400">{backstop.authenticated ? 'Open app' : 'Connect wallet'}</button>
      </header>
      <section className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:pt-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/5 px-4 py-2 font-mono text-xs font-semibold tracking-[.16em] text-cyan-300"><span className="signal-dot h-2 w-2 rounded-full bg-cyan-400" />LIVE ON SEPOLIA</p>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">Liquidation <span className="bg-gradient-to-r from-cyan-400 via-blue-300 to-violet-500 bg-clip-text text-transparent">liquidity</span>, without giving up control.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">Backstop lets capital providers pre-authorize self-custodied liquidity for DeFi liquidations while keeping pricing private and execution bounded by programmable rules.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button onClick={launch} className="rounded-xl border border-cyan-400/50 bg-cyan-400/10 px-6 py-3 text-sm font-semibold text-cyan-300 shadow-[0_0_28px_rgba(29,191,255,.1)] hover:bg-cyan-400/20">Launch Backstop ↗</button>
            <a href="#how-it-works" className="rounded-xl px-5 py-3 text-sm font-medium text-slate-400 hover:text-white">⌘ See how it works</a>
          </div>
        </div>
        <div className="hero-orb rounded-3xl border border-[#23395c] bg-[#070d20]/85 p-6 shadow-2xl shadow-violet-950/30 sm:p-8">
          <p className="text-xs font-semibold tracking-widest text-slate-500">ONE EXECUTION PATH</p>
          <div className="mt-7 space-y-3 text-center text-sm">
            <Node title="Capital provider" detail="USDC + rules" />
            <Arrow />
            <Node title="Backstop" detail="private quote + policy checks" accent />
            <Arrow />
            <Node title="Liquidator + opportunity" detail="Aave V3 position" />
            <Arrow />
            <Node title="Lending protocol" detail="settlement to maker" />
          </div>
        </div>
      </section>
      <section id="how-it-works" className="border-y border-[#1d2b45] bg-[#050b1a]/80 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl"><p className="text-xs font-semibold tracking-[.18em] text-emerald-300">HOW IT WORKS</p><div className="mt-8 grid gap-5 md:grid-cols-3"><Feature n="01" title="Authorize capital" text="Set your size, discount range, asset pair, and expiry. Capital remains in your wallet." /><Feature n="02" title="Match privately" text="Backstop checks an opportunity and quote against your onchain policy." /><Feature n="03" title="Execute within bounds" text="A liquidator uses only the capital and execution path your rules permit." /></div></div>
      </section>
    </main>
  );
}

function Node({title, detail, accent = false}: {title: string; detail: string; accent?: boolean}) { return <div className={`rounded-xl border p-4 ${accent ? 'border-cyan-400/50 bg-gradient-to-r from-cyan-400/15 to-violet-500/15 text-cyan-100' : 'border-[#263957] bg-[#030816] text-slate-100'}`}><p className="font-medium">{title}</p><p className={`mt-1 text-xs ${accent ? 'text-cyan-300/70' : 'text-slate-500'}`}>{detail}</p></div>; }
function Arrow() { return <div className="text-cyan-400/50">↓</div>; }
function Feature({n, title, text}: {n: string; title: string; text: string}) { return <article className="rounded-2xl border border-[#203451] bg-[#030816]/80 p-6"><p className="text-xs font-semibold text-cyan-300">{n}</p><h2 className="mt-5 text-xl font-medium">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{text}</p></article>; }
