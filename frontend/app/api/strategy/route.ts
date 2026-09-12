import { NextRequest, NextResponse } from 'next/server';
import { strategyDb, Strategy } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const strategy = strategyDb.getByWallet(walletAddress);
    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('Error fetching strategy:', error);
    return NextResponse.json({ error: 'Failed to fetch strategy' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, maker, token_in, token_out, max_trade, min_discount_bps, max_discount_bps, expiry, salt } = body;

    if (!wallet_address || !maker || !token_in || !token_out || !max_trade || !min_discount_bps || !max_discount_bps || !expiry || !salt) {
      return NextResponse.json({ error: 'All strategy fields are required' }, { status: 400 });
    }

    const strategy: Omit<Strategy, 'id' | 'created_at' | 'updated_at'> = {
      wallet_address,
      maker,
      token_in,
      token_out,
      max_trade,
      min_discount_bps,
      max_discount_bps,
      expiry,
      salt,
    };

    strategyDb.upsert(strategy);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error upserting strategy:', error);
    return NextResponse.json({ error: 'Failed to upsert strategy' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    strategyDb.deleteByWallet(walletAddress);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting strategy:', error);
    return NextResponse.json({ error: 'Failed to delete strategy' }, { status: 500 });
  }
}