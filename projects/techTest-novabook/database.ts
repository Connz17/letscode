import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createDatabase(path = process.env.SQLITE_DB_PATH ?? "data/tax-position.sqlite"): DatabaseSync {
  const databasePath = path === ":memory:" ? path : resolve(path);

  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sale_item_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      cost REAL NOT NULL,
      tax_rate REAL NOT NULL,
      effective_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sale_item_events_as_of
      ON sale_item_events (effective_at, invoice_id, item_id);

    CREATE TABLE IF NOT EXISTS tax_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      effective_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS tax_payments_as_of
      ON tax_payments (effective_at);
  `);

  return database;
}