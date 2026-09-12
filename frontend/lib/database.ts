import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'backstop.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash TEXT UNIQUE NOT NULL,
    timestamp TEXT NOT NULL,
    usdc_deployed TEXT,
    weth_pushed TEXT,
    maker_usdc_before TEXT,
    maker_usdc_after TEXT,
    maker_weth_before TEXT,
    maker_weth_after TEXT,
    simulated INTEGER NOT NULL DEFAULT 0,
    wallet_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    wallet_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS policy_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    wallet_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL UNIQUE,
    maker TEXT NOT NULL,
    token_in TEXT NOT NULL,
    token_out TEXT NOT NULL,
    max_trade TEXT NOT NULL,
    min_discount_bps TEXT NOT NULL,
    max_discount_bps TEXT NOT NULL,
    expiry TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_logs_wallet ON logs(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_policy_logs_wallet ON policy_logs(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_strategies_wallet ON strategies(wallet_address);
`);

export interface Transaction {
  id?: number;
  tx_hash: string;
  timestamp: string;
  usdc_deployed?: string;
  weth_pushed?: string;
  maker_usdc_before?: string;
  maker_usdc_after?: string;
  maker_weth_before?: string;
  maker_weth_after?: string;
  simulated: boolean;
  wallet_address?: string;
  created_at?: string;
}

export interface LogEntry {
  id?: number;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'policy';
  wallet_address?: string;
  created_at?: string;
}

export interface Strategy {
  id?: number;
  wallet_address: string;
  maker: string;
  token_in: string;
  token_out: string;
  max_trade: string;
  min_discount_bps: string;
  max_discount_bps: string;
  expiry: string;
  salt: string;
  created_at?: string;
  updated_at?: string;
}

export const transactionDb = {
  insert: (tx: Omit<Transaction, 'id' | 'created_at'>) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO transactions 
      (tx_hash, timestamp, usdc_deployed, weth_pushed, maker_usdc_before, maker_usdc_after, maker_weth_before, maker_weth_after, simulated, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      tx.tx_hash,
      tx.timestamp,
      tx.usdc_deployed || null,
      tx.weth_pushed || null,
      tx.maker_usdc_before || null,
      tx.maker_usdc_after || null,
      tx.maker_weth_before || null,
      tx.maker_weth_after || null,
      tx.simulated ? 1 : 0,
      tx.wallet_address || null
    );
  },

  getByWallet: (walletAddress: string, limit = 50) => {
    const stmt = db.prepare(`
      SELECT * FROM transactions 
      WHERE wallet_address = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(walletAddress, limit) as Transaction[];
  },

  getAll: (limit = 100) => {
    const stmt = db.prepare(`
      SELECT * FROM transactions 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as Transaction[];
  },

  deleteByWallet: (walletAddress: string) => {
    const stmt = db.prepare('DELETE FROM transactions WHERE wallet_address = ?');
    return stmt.run(walletAddress);
  },
};

export const logDb = {
  insert: (log: Omit<LogEntry, 'id' | 'created_at'>) => {
    const stmt = db.prepare(`
      INSERT INTO logs (timestamp, message, type, wallet_address)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(log.timestamp, log.message, log.type, log.wallet_address || null);
  },

  getByWallet: (walletAddress: string, limit = 100) => {
    const stmt = db.prepare(`
      SELECT * FROM logs 
      WHERE wallet_address = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(walletAddress, limit) as LogEntry[];
  },

  getAll: (limit = 200) => {
    const stmt = db.prepare(`
      SELECT * FROM logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as LogEntry[];
  },

  deleteByWallet: (walletAddress: string) => {
    const stmt = db.prepare('DELETE FROM logs WHERE wallet_address = ?');
    return stmt.run(walletAddress);
  },
};

export const policyLogDb = {
  insert: (log: Omit<LogEntry, 'id' | 'created_at'>) => {
    const stmt = db.prepare(`
      INSERT INTO policy_logs (timestamp, message, type, wallet_address)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(log.timestamp, log.message, log.type, log.wallet_address || null);
  },

  getByWallet: (walletAddress: string, limit = 100) => {
    const stmt = db.prepare(`
      SELECT * FROM policy_logs 
      WHERE wallet_address = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(walletAddress, limit) as LogEntry[];
  },

  getAll: (limit = 200) => {
    const stmt = db.prepare(`
      SELECT * FROM policy_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as LogEntry[];
  },

  deleteByWallet: (walletAddress: string) => {
    const stmt = db.prepare('DELETE FROM policy_logs WHERE wallet_address = ?');
    return stmt.run(walletAddress);
  },
};

export const strategyDb = {
  upsert: (strategy: Omit<Strategy, 'id' | 'created_at' | 'updated_at'>) => {
    const stmt = db.prepare(`
      INSERT INTO strategies (wallet_address, maker, token_in, token_out, max_trade, min_discount_bps, max_discount_bps, expiry, salt, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(wallet_address) DO UPDATE SET
        maker = excluded.maker,
        token_in = excluded.token_in,
        token_out = excluded.token_out,
        max_trade = excluded.max_trade,
        min_discount_bps = excluded.min_discount_bps,
        max_discount_bps = excluded.max_discount_bps,
        expiry = excluded.expiry,
        salt = excluded.salt,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(
      strategy.wallet_address,
      strategy.maker,
      strategy.token_in,
      strategy.token_out,
      strategy.max_trade,
      strategy.min_discount_bps,
      strategy.max_discount_bps,
      strategy.expiry,
      strategy.salt
    );
  },

  getByWallet: (walletAddress: string) => {
    const stmt = db.prepare('SELECT * FROM strategies WHERE wallet_address = ? ORDER BY updated_at DESC LIMIT 1');
    return stmt.get(walletAddress) as Strategy | undefined;
  },

  deleteByWallet: (walletAddress: string) => {
    const stmt = db.prepare('DELETE FROM strategies WHERE wallet_address = ?');
    return stmt.run(walletAddress);
  },
};

export { db };