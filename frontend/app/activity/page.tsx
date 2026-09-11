'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, ActivityTimeline} from '@/components';

export default function ActivityPage() {
  const backstop = useBackstop();
  const events = backstop.logs.slice().reverse().slice(0, 12).map((log) => ({
    time: log.time,
    label: eventLabel(log.message),
    status: log.type,
    description: log.message,
    simulated: backstop.executionResult?.simulated && log.message.includes('Swap executed'),
  }));

  return <div className="protocol-surface flex min-h-screen flex-col bg-[#030816]">
    <Header systemStatus={backstop.systemStatus} statusLabel={backstop.statusLabel} walletAddress={backstop.embeddedWallet?.address} network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`} onLogout={backstop.logout} />
    <Navigation items={[{label: 'Dashboard', href: '/overview'}, {label: 'Strategy', href: '/strategy'}, {label: 'Liquidations', href: '/opportunities'}, {label: 'Activity', href: '/activity', active: true}]} />
    <main className="flex-1"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {!backstop.authenticated ? <Connect onClick={backstop.login} /> : <div className="space-y-8">
        <div><p className="text-xs font-semibold tracking-[.16em] text-cyan-300">OPERATIONS LOG</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Activity</h1><p className="mt-2 text-sm text-zinc-500">A concise record of your strategy and liquidation activity.</p></div>
        <ActivityTimeline events={events} />
      </div>}
    </div></main>
  </div>;
}

function Connect({onClick}: {onClick: () => void}) { return <div className="flex flex-col items-center justify-center py-24 text-center"><h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Connect to view activity</h2><p className="mt-2 text-sm text-zinc-500">Your strategy and execution history appears here.</p><button onClick={onClick} className="mt-6 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300">Connect wallet</button></div>; }

function eventLabel(message: string) { if (message.includes('Strategy shipped')) return 'Strategy activated'; if (message.includes('Swap executed')) return 'Liquidation executed'; if (message.includes('Approve')) return 'Aqua approved'; if (message.includes('Quote')) return 'Quote updated'; return 'Backstop update'; }
