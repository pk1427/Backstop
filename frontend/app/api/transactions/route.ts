import { NextRequest, NextResponse } from 'next/server';
import { transactionDb, Transaction } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (walletAddress) {
      const transactions = transactionDb.getByWallet(walletAddress, limit);
      return NextResponse.json({ transactions });
    }

    const transactions = transactionDb.getAll(limit);
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tx_hash, timestamp, usdc_deployed, weth_pushed, maker_usdc_before, maker_usdc_after, maker_weth_before, maker_weth_after, simulated, wallet_address } = body;

    if (!tx_hash || !timestamp) {
      return NextResponse.json({ error: 'tx_hash and timestamp are required' }, { status: 400 });
    }

    const tx: Omit<Transaction, 'id' | 'created_at'> = {
      tx_hash,
      timestamp,
      usdc_deployed,
      weth_pushed,
      maker_usdc_before,
      maker_usdc_after,
      maker_weth_before,
      maker_weth_after,
      simulated: simulated || false,
      wallet_address,
    };

    transactionDb.insert(tx);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error inserting transaction:', error);
    return NextResponse.json({ error: 'Failed to insert transaction' }, { status: 500 });
  }
}