// Server-only: database access for the hosted widget.
//
// DATABASE_URL selects the database:
//   postgres://… or postgresql://…   a real PostgreSQL server (production).
//   pglite:./.data/pglite             embedded PostgreSQL in a local folder (local development).
//   pglite:memory                     embedded, in-memory (tests).
// Without DATABASE_URL the widget reports itself as unavailable instead of losing data.

import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs one or more statements without parameters (used for migrations). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export class DatabaseNotConfiguredError extends Error {
  constructor(message = "DATABASE_URL is not set") {
    super(message);
    this.name = "DatabaseNotConfiguredError";
  }
}

export function databaseUrl(): string {
  // POSTGRES_URL is what some Vercel Marketplace Postgres integrations set instead.
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";
}

export function isDatabaseConfigured(): boolean {
  const url = databaseUrl();
  if (/^postgres(ql)?:\/\//i.test(url)) return true;
  // An embedded database on a serverless host would be wiped between requests, so refuse it there.
  return url.startsWith("pglite:") && !process.env.VERCEL;
}

export async function openPglite(location: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (location !== "memory") await mkdir(path.resolve(location), { recursive: true });
  const pg = location === "memory" ? new PGlite() : new PGlite(path.resolve(location));
  await pg.waitReady;
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query<T>(sql, params)).rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
}

async function openPostgres(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

/** Opens a database from a DATABASE_URL-style string. Callers own the returned handle. */
export async function openDb(url = databaseUrl()): Promise<Db> {
  if (/^postgres(ql)?:\/\//i.test(url)) return openPostgres(url);
  if (url.startsWith("pglite:")) return openPglite(url.slice("pglite:".length) || "memory");
  throw new DatabaseNotConfiguredError();
}

// One shared handle per server process. Kept on globalThis so hot reloads and separately
// bundled routes reuse it; an embedded database must never be opened twice.
const globalStore = globalThis as typeof globalThis & { __convohatchWidgetDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!isDatabaseConfigured()) return Promise.reject(new DatabaseNotConfiguredError());
  globalStore.__convohatchWidgetDb ??= (async () => {
    const url = databaseUrl();
    const db = await openDb(url);
    // Local embedded databases migrate themselves; real servers use `npm run widget -- migrate`.
    if (url.startsWith("pglite:")) await migrate(db);
    return db;
  })().catch((error) => {
    globalStore.__convohatchWidgetDb = undefined;
    throw error;
  });
  return globalStore.__convohatchWidgetDb;
}

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

/** Applies any migrations in db/migrations that haven't run yet, in filename order. */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const done = new Set(
    (await db.query<{ version: string }>("SELECT version FROM schema_migrations")).map((row) => row.version),
  );
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    const version = file.replace(/'/g, "''");
    // Sent as one multi-statement query, which PostgreSQL runs as a single implicit transaction:
    // a failing migration leaves no partial changes and isn't recorded.
    await db.exec(`${sql}\nINSERT INTO schema_migrations (version) VALUES ('${version}');`);
    applied.push(file);
  }
  return applied;
}
