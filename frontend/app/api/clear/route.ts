import { NextRequest, NextResponse } from 'next/server';
import { transactionDb, logDb, policyLogDb, strategyDb } from '@/lib/database';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    transactionDb.deleteByWallet(walletAddress);
    logDb.deleteByWallet(walletAddress);
    policyLogDb.deleteByWallet(walletAddress);
    strategyDb.deleteByWallet(walletAddress);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing data:', error);
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}