import Link from 'next/link';
import {Header} from '@/components';

const principles = [
  {
    title: 'Self-custodial',
    copy: 'Capital never leaves your wallet until execution.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 8.25V6.75a4.5 4.5 0 00-9 0v1.5M6.75 10.5h10.5v9h-10.5v-9z" />
      </svg>
    ),
  },
  {
    title: 'Privately priced',
    copy: "Chainlink CRE computes your discount curve inside a TEE; only the resulting quote is public.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.25 3h7.5v3h-7.5v-3zM6 6h12a2.25 2.25 0 012.25 2.25v9A2.25 2.25 0 0118 19.5H6a2.25 2.25 0 01-2.25-2.25v-9A2.25 2.25 0 016 6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 12.75l1.5 1.5 3-3" />
      </svg>
    ),
  },
  {
    title: 'Policy-bounded',
    copy: 'Immutable Aqua bounds and Privy-scoped authorization enforce hard limits automatically.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 4.418-2.903 8.143-7 9.5-4.097-1.357-7-5.082-7-9.5V6l7-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

const steps = [
  {number: '01', title: 'Opportunity appears', copy: 'A liquidation is detected.'},
  {number: '02', title: 'Private quote', copy: "The maker's discount curve is priced inside a TEE."},
  {number: '03', title: 'Bounds checked', copy: 'The quote is tested against immutable strategy limits.'},
  {number: '04', title: 'Atomic settlement', copy: 'USDC is pulled, WETH is pushed, and the position settles atomically.'},
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header variant="landing" />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-24">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Confidential liquidation infrastructure</p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] text-text-primary sm:text-5xl lg:text-6xl">
                Capital that stays in your wallet until a liquidation opportunity clears a pricing rule no one else can see.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
                A self-custodial, privately-priced, policy-bounded liquidation-liquidity position for institutional makers.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/overview"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Launch App
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link href="#how-it-works" className="text-sm font-semibold text-text-primary underline decoration-border underline-offset-4 hover:decoration-accent">
                  See how it settles
                </Link>
              </div>
              <p className="mt-8 max-w-xl text-xs leading-5 text-text-secondary">
                Built on 1inch Aqua / SwapVM, Chainlink CRE, and Privy. Sepolia demo environment.
              </p>
            </div>

            <div className="flex items-center" aria-label="Backstop settlement sequence">
              <div className="w-full rounded-xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Sealed execution brief</p>
                    <p className="mt-1 text-sm text-text-primary">Maker risk envelope</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                    SEALED
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ['Capital location', 'Maker wallet'],
                    ['Pricing surface', 'Private curve / TEE'],
                    ['Execution bounds', 'Immutable policy'],
                    ['Settlement', 'USDC in / WETH out'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <p className="text-xs text-text-secondary">{label}</p>
                      <p className="text-right text-xs font-medium text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <p className="text-[11px] uppercase tracking-wide text-text-secondary">Quote visibility</p>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    <p className="text-xs font-medium text-text-primary">Revealed at execution</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8 lg:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">What this is</p>
              <h2 className="mt-4 text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">Underwriting controls for on-chain liquidation risk.</h2>
            </div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {principles.map((principle) => (
                <article key={principle.title} className="rounded-xl border border-border bg-background p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">{principle.icon}</div>
                  <h3 className="mt-5 text-sm font-semibold text-text-primary">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{principle.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8 lg:py-16">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">How it works</p>
                <h2 className="mt-4 text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">One opportunity. Four controlled transitions.</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-text-secondary">The maker defines the risk envelope once. Every quote must clear it before capital can move.</p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-4">
              {steps.map((step, index) => (
                <article key={step.number} className="relative rounded-xl border border-border bg-surface p-5">
                  {index < steps.length - 1 && (
                    <svg className="absolute -right-3 top-1/2 z-10 h-6 w-6 -translate-y-1/2 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{step.number}</p>
                  <h3 className="mt-4 text-sm font-semibold text-text-primary">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center lg:px-8 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Built for makers</p>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
              Provide liquidation liquidity without surrendering custody or pricing control.
            </h2>
            <Link
              href="/overview"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Launch App
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <p className="mt-7 text-xs uppercase tracking-[0.18em] text-text-secondary">Built with 1inch Aqua · Chainlink CRE · Privy</p>
          </div>
        </section>
      </main>
    </div>
  );
}
