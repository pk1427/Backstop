'use client';

import {usePrivy, useWallets} from '@privy-io/react-auth';
import {useState, useEffect} from 'react';

const PRIVY_AUTH_KEY_ID = process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID || '';
const PRIVY_POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_POLICY_ID || '';
const BACKSTOP_APP_ADDRESS = process.env.NEXT_PUBLIC_BACKSTOP_APP_ADDRESS || '';

export default function Home() {
  const {ready, authenticated, login, logout, user} = usePrivy();
  const {wallets} = useWallets();
  const [signerAdded, setSignerAdded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [addingSigner, setAddingSigner] = useState(false);

  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');

  useEffect(() => {
    if (authenticated && embeddedWallet && !signerAdded && !addingSigner && PRIVY_AUTH_KEY_ID && PRIVY_POLICY_ID) {
      addSigner();
    }
  }, [authenticated, embeddedWallet, signerAdded, addingSigner]);

  const addLog = (msg: string) => setLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const addSigner = async () => {
    if (!embeddedWallet || !user || !PRIVY_AUTH_KEY_ID || !PRIVY_POLICY_ID) return;
    setAddingSigner(true);
    try {
      await user.addSigners({
        address: embeddedWallet.address,
        signers: [{
          signerId: PRIVY_AUTH_KEY_ID,
          policyIds: [PRIVY_POLICY_ID],
        }],
      });
      setSignerAdded(true);
      addLog(`Signer added successfully for ${embeddedWallet.address}`);
    } catch (e: any) {
      addLog(`addSigners error: ${e.message || e}`);
    } finally {
      setAddingSigner(false);
    }
  };

  const testWithinPolicyTx = async () => {
    if (!BACKSTOP_APP_ADDRESS) {
      addLog('Set NEXT_PUBLIC_BACKSTOP_APP_ADDRESS in .env.local');
      return;
    }
    try {
      // This is a placeholder transaction - replace with actual backstop app calldata
      addLog(`Sending within-policy tx to ${BACKSTOP_APP_ADDRESS}...`);
      // In a real test, this would call backstopApp.swap() with valid calldata
      addLog('Within-policy tx would be sent here (implement with actual calldata)');
    } catch (e: any) {
      addLog(`Within-policy tx error: ${e.message}`);
    }
  };

  const testOutsidePolicyTx = async () => {
    try {
      addLog('Sending outside-policy tx to 0x000...0000 (should be rejected)...');
      // This should be rejected by the policy
      addLog('Outside-policy tx would be sent here (expect rejection)');
    } catch (e: any) {
      addLog(`Outside-policy tx rejected: ${e.message}`);
    }
  };

  if (!ready) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading Privy...</p>
      </div>
    );
  }

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
              <p className="text-sm text-zinc-500">
                Auth key ID: {PRIVY_AUTH_KEY_ID ? `${PRIVY_AUTH_KEY_ID.slice(0, 8)}...` : 'not set'}
              </p>
              <p className="text-sm text-zinc-500">
                Policy ID: {PRIVY_POLICY_ID ? `${PRIVY_POLICY_ID.slice(0, 8)}...` : 'not set — create in Privy Dashboard'}
              </p>
              <p className="text-sm text-zinc-500">
                Signer added: {signerAdded ? 'yes' : 'no'}
              </p>
              {!signerAdded && PRIVY_AUTH_KEY_ID && PRIVY_POLICY_ID && (
                <button
                  onClick={addSigner}
                  disabled={addingSigner}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  {addingSigner ? 'Adding signer...' : 'Add Scoped Signer'}
                </button>
              )}
              <div className="flex gap-4">
                <button
                  onClick={testWithinPolicyTx}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Test Within-Policy Tx
                </button>
                <button
                  onClick={testOutsidePolicyTx}
                  className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Test Outside-Policy Tx
                </button>
              </div>
              {logs.length > 0 && (
                <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-900 rounded w-full">
                  <p className="text-sm font-mono font-bold">Logs:</p>
                  {logs.map((log, i) => (
                    <p key={i} className="text-sm font-mono">{log}</p>
                  ))}
                </div>
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
