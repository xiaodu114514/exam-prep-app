import { describe, expect, it } from 'vitest'
import { openDatabase, migrate, SCHEMA_VERSION } from '../src/db'

function tableNames(db: ReturnType<typeof openDatabase>): string[] {
  return (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(
    (r) => r.name,
  )
}

describe('数据库初始化与 schema 版本管理', () => {
  it('建表齐全、user_version 与常量一致、外键开启', () => {
    const db = openDatabase(':memory:')
    const tables = tableNames(db)
    for (const t of ['users', 'sessions', 'exam', 'subjects', 'sites', 'tasks', 'data_backups']) {
      expect(tables).toContain(t)
    }
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it('exam 表恒为单行（幂等初始化）', () => {
    const db = openDatabase(':memory:')
    const count = (db.prepare(`SELECT COUNT(*) AS c FROM exam`).get() as { c: number }).c
    expect(count).toBe(1)
  })

  it('migrate 幂等：重复执行不报错且版本不变', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    migrate(db)
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect((db.prepare(`SELECT COUNT(*) AS c FROM exam`).get() as { c: number }).c).toBe(1)
  })

  it('外键约束生效：任务引用不存在的科目被拒绝', () => {
    const db = openDatabase(':memory:')
    expect(() =>
      db
        .prepare(`INSERT INTO tasks (id, title, date, subject_id) VALUES ('t','x','2025-01-01','ghost')`)
        .run(),
    ).toThrow()
  })

  it('CHECK 约束生效：total <= 0 的科目被拒绝', () => {
    const db = openDatabase(':memory:')
    expect(() =>
      db.prepare(`INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s','x','项',0,0)`).run(),
    ).toThrow()
  })

  it('CHECK 约束生效：completed 超过 total 的科目被拒绝', () => {
    const db = openDatabase(':memory:')
    expect(() =>
      db
        .prepare(`INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s','x','项',100,101)`)
        .run(),
    ).toThrow()
  })
})
