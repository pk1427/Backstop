import { NextRequest, NextResponse } from 'next/server';
import { logDb, policyLogDb, LogEntry } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (type === 'policy') {
      if (walletAddress) {
        const logs = policyLogDb.getByWallet(walletAddress, limit);
        return NextResponse.json({ logs });
      }
      const logs = policyLogDb.getAll(limit);
      return NextResponse.json({ logs });
    }

    if (walletAddress) {
      const logs = logDb.getByWallet(walletAddress, limit);
      return NextResponse.json({ logs });
    }

    const logs = logDb.getAll(limit);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timestamp, message, type, wallet_address, logType } = body;

    if (!timestamp || !message || !type) {
      return NextResponse.json({ error: 'timestamp, message, and type are required' }, { status: 400 });
    }

    const log: Omit<LogEntry, 'id' | 'created_at'> = {
      timestamp,
      message,
      type,
      wallet_address,
    };

    if (logType === 'policy') {
      policyLogDb.insert(log);
    } else {
      logDb.insert(log);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error inserting log:', error);
    return NextResponse.json({ error: 'Failed to insert log' }, { status: 500 });
  }
}