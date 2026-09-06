'use client';

import {usePrivy, useWallets} from '@privy-io/react-auth';

export default function Home() {
  const {ready, authenticated, login, logout, user} = usePrivy();
  const {wallets} = useWallets();

  if (!ready) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading Privy...</p>
      </div>
    );
  }

  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          Confidential Liquidation Backstop
        </h1>
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          {!authenticated ? (
            <button
              onClick={login}
              className="rounded-full bg-foreground px-5 py-3 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Login with Privy
            </button>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                Logged in as: {user?.email?.address || user?.phone?.number || 'User'}
              </p>
              {embeddedWallet ? (
                <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                  Embedded wallet: {embeddedWallet.address}
                </p>
              ) : (
                <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                  No embedded wallet found
                </p>
              )}
              <button
                onClick={logout}
                className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
