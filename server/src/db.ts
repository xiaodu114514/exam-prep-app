import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type DB = Database.Database

export interface UserRow {
  id: number
  username: string
  password_hash: string
  created_at: string
}

export interface SessionRow {
  token_sha256: string
  user_id: number
  created_at: string
  expires_at: string
}

export interface ExamRow {
  id: number
  name: string
  date: string
}

export interface SubjectRow {
  id: string
  name: string
  unit: string
  total: number
  completed: number
}

export interface SiteRow {
  id: string
  name: string
  url: string
}

export interface TaskRow {
  id: string
  title: string
  date: string
  completed: number
  subject_id: string | null
  amount: number | null
  contributed: number
  daily: number
  done_date: string | null
}

const SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 只存 Session Token 的 SHA-256 摘要；Cookie 携带原始随机 Token
CREATE TABLE IF NOT EXISTS sessions (
  token_sha256 TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 考试信息（单行表，id 恒为 1）
CREATE TABLE IF NOT EXISTS exam (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '项',
  total REAL NOT NULL CHECK (total > 0),
  completed REAL NOT NULL DEFAULT 0 CHECK (completed >= 0 AND completed <= total)
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  amount REAL,
  -- 该任务当前对科目的实际贡献量（精确记账，保证取消勾选时对称回退）
  contributed REAL NOT NULL DEFAULT 0 CHECK (contributed >= 0),
  CHECK (amount IS NULL OR amount > 0)
);

-- 导入前的数据快照备份（由 /api/data/import 在事务内自动写入）
CREATE TABLE IF NOT EXISTS data_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload TEXT NOT NULL
);
`

/** 当前程序支持的 schema 版本（与 PRAGMA user_version 对应） */
export const SCHEMA_VERSION = 2

/**
 * 迁移步骤列表：索引 = 当前 user_version，执行后写入 user_version = 索引 + 1。
 * 未来结构变更时追加新步骤（例如 v2 -> v3 时在数组末尾加一个函数）。
 */
const MIGRATIONS: Array<(db: DB) => void> = [
  (db) => {
    db.exec(SCHEMA_V1_SQL)
  },
  // v2：任务支持「每日任务」（daily 标记 + done_date 记录最近完成日期）
  (db) => {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN daily INTEGER NOT NULL DEFAULT 0 CHECK (daily IN (0,1));
      ALTER TABLE tasks ADD COLUMN done_date TEXT;
    `)
  },
]

export function openDatabase(dbPath: string): DB {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL')
  }
  migrate(db)
  return db
}

export function migrate(db: DB): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `数据库 schema 版本 ${current} 高于程序支持的 ${SCHEMA_VERSION}，请先升级程序`,
    )
  }
  for (let v = current; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) throw new Error(`缺少 schema 迁移步骤 v${v}`)
    db.transaction(() => {
      step(db)
      db.pragma(`user_version = ${v + 1}`)
    })()
  }
  // 幂等保障：考试信息恒为单行
  db.prepare(`INSERT OR IGNORE INTO exam (id, name, date) VALUES (1, '', '')`).run()
}
