import { DatabaseSync } from "node:sqlite";
export class Store {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
  }
  get(key, fallback) {
    const row = this.db
      .prepare("SELECT value FROM state WHERE key = ?")
      .get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  set(key, value) {
    this.db
      .prepare(
        "INSERT INTO state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  setMany(entries) {
    // A queue checkpoint must never contain jobs from one save and counters
    // from another. Roll back the entire checkpoint if any value fails.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const [key, value] of Object.entries(entries)) this.set(key, value);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
