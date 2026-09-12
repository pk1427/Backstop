'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, ActivityTimeline} from '@/components';

export default function ActivityPage() {
  const backstop = useBackstop();
  const events = confirmedMilestones(backstop.logs);

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

type ActivityLog = {time: string; message: string; type: 'info' | 'success' | 'error' | 'policy'};

function confirmedMilestones(logs: ActivityLog[]) {
  let pending: 'approval' | 'strategy' | null = null;
  const milestones: {time: string; label: string; status: 'success'; description: string; txHash: string; details?: {label: string; value: string}[]}[] = [{
    time: '03:20:24',
    label: 'Controlled liquidation settled',
    description: '500 btUSDC repaid · 0.3500 btWETH settled to the controlled maker',
    status: 'success',
    txHash: '0xa325d92a25340adf68c18f3951173e539aca8c84e26ba7c11b1f0127cb684943',
    details: [
      {label: 'Market', value: 'Controlled mock market · Ethereum Sepolia'},
      {label: 'Borrower', value: '0xf62c155Eb012303Cbba80cb246De20E05dd57051'},
      {label: 'Oracle event', value: 'btWETH price moved from $2,000 to $1,500 · HF 1.1333 → 0.8500'},
      {label: 'CRE quote', value: '121 bps · 500 btUSDC · quote ID 0xfc011f…a69d5c'},
      {label: 'Settlement', value: '500 btUSDC repaid · 0.3500 btWETH delivered to maker'},
      {label: 'Replay protection', value: 'Quote consumed onchain'},
    ],
  }];

  for (const log of logs) {
    const calibration = log.message.match(/^Risk calibration confirmed: withdrew ([\d.]+ WETH) from Position (\d+) \(HF ([\d.]+)\) — (0x[a-fA-F0-9]{64})$/);
    if (calibration) {
      milestones.push({
        time: log.time,
        label: 'Collateral safety buffer reduced',
        description: `Position ${calibration[2]}: ${calibration[1]} withdrawn · HF ${calibration[3]}`,
        status: 'success',
        txHash: calibration[4],
      });
      continue;
    }
    if (log.message.includes('Sending approve(')) pending = 'approval';
    if (log.message.includes('Shipping strategy')) pending = 'strategy';
    const txHash = log.message.match(/0x[a-fA-F0-9]{64}/)?.[0];
    if (!txHash || !log.message.includes('Transaction succeeded') || !pending) continue;
    milestones.push({
      time: log.time,
      label: pending === 'approval' ? 'Aqua approved' : 'Strategy shipped',
      description: pending === 'approval' ? 'USDC authorization confirmed on Sepolia' : 'Your execution policy is active on Sepolia',
      status: 'success',
      txHash,
    });
    pending = null;
  }

  return milestones.slice(-3).reverse();
}
