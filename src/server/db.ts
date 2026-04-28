import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "chat.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_session_created_at ON messages(session_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
