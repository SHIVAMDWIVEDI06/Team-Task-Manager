// Database access layer on top of node:sqlite (synchronous, WAL mode).
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import { migrations } from './schema.ts';

export type Param = SQLInputValue;
export type Row = Record<string, unknown>;

export class Database {
  private db: DatabaseSync;
  private cache = new Map<string, ReturnType<DatabaseSync['prepare']>>();
  private txDepth = 0;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  private stmt(sql: string) {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      if (this.cache.size > 500) this.cache.clear();
      this.cache.set(sql, s);
    }
    return s;
  }

  all<T = Row>(sql: string, params: Param[] = []): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  one<T = Row>(sql: string, params: Param[] = []): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  run(sql: string, params: Param[] = []): { changes: number } {
    const r = this.stmt(sql).run(...params);
    return { changes: Number(r.changes) };
  }

  exec(sql: string) {
    this.db.exec(sql);
  }

  /** Run `fn` inside a transaction (nested calls join the outer transaction). */
  tx<T>(fn: () => T): T {
    if (this.txDepth > 0) {
      this.txDepth++;
      try {
        return fn();
      } finally {
        this.txDepth--;
      }
    }
    this.db.exec('BEGIN IMMEDIATE');
    this.txDepth = 1;
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.txDepth = 0;
    }
  }

  migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const applied = new Set(this.all<{ id: string }>('SELECT id FROM _migrations').map((r) => r.id));
    for (const m of migrations) {
      if (applied.has(m.id)) continue;
      this.tx(() => {
        this.db.exec(m.sql);
        this.run('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)', [m.id, new Date().toISOString()]);
      });
      console.log(`[db] applied migration ${m.id}`);
    }
  }

  close() {
    this.db.close();
  }
}

export const db = new Database(config.dbFile);
db.migrate();

export const now = () => new Date().toISOString();

/** Build an `IN (?, ?, ...)` clause safely. Returns [clause, params]. */
export function inList(values: readonly Param[]): string {
  return values.length ? `(${values.map(() => '?').join(',')})` : '(NULL)';
}

export function parseJSON<T>(text: unknown, fallback: T): T {
  if (typeof text !== 'string' || !text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
