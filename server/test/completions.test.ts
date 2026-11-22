import { describe, expect, it } from 'vitest'
import { createTestApp, login, authedRequest } from './helpers'
import { migrate, openDatabase } from '../src/db'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function todayKey(): string {
  return dateKey(new Date())
}
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateKey(d)
}

async function setup() {
  const { app, db } = createTestApp()
  db.prepare(
    `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',1000,0)`,
  ).run()
  const { cookie } = await login(app)
  return { app, db, cookie }
}

type Setup = Awaited<ReturnType<typeof setup>>

async function createDaily(
  app: Setup['app'],
  cookie: string,
  opts: { date?: string; amount?: number; subjectId?: string } = {},
) {
  const res = await authedRequest(app, cookie, 'POST', '/api/tasks', {
    title: '每日背单词',
    date: opts.date ?? daysAgo(7),
    subjectId: opts.subjectId ?? 's1',
    amount: opts.amount ?? 30,
    daily: true,
  })
  return res.json().task.id as string
}

async function patch(app: Setup['app'], cookie: string, id: string, body: Record<string, unknown>) {
  return authedRequest(app, cookie, 'PATCH', `/api/tasks/${id}`, body)
}

async function getTask(app: Setup['app'], cookie: string, id: string) {
  const res = await authedRequest(app, cookie, 'GET', '/api/data')
  return res.json().tasks.find((t: { id: string }) => t.id === id) as {
    id: string
    completed: boolean
    completions: Array<{ date: string; completedAmount: number | null; contributed: number }>
    doneDate: string | null
  }
}

function subjectCompleted(db: Setup['db'], id = 's1'): number {
  return (db.prepare(`SELECT completed FROM subjects WHERE id = ?`).get(id) as { completed: number })
    .completed
}

describe('每日任务按日期独立记录（task_completions）', () => {
  it('日期独立性：完成周二，周一仍未完成', async () => {
    const { app, cookie } = await setup()
    const id = await createDaily(app, cookie)

    const res = await patch(app, cookie, id, { completed: true, doneDate: todayKey() })
    expect(res.statusCode).toBe(200)
    const task = await getTask(app, cookie, id)
    expect(task.completions.map((c) => c.date)).toEqual([todayKey()])
    // 周一没有任何记录
    const monday = (await getTask(app, cookie, id)).completions.some((c) => c.date === daysAgo(1))
    expect(monday).toBe(false)
  })

  it('日期独立性：周二补录周一，周一周二都完成', async () => {
    const { app, cookie } = await setup()
    const id = await createDaily(app, cookie)

    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) }) // 补录周一
    await patch(app, cookie, id, { completed: true, doneDate: todayKey() }) // 完成周二

    const task = await getTask(app, cookie, id)
    expect(task.completions.map((c) => c.date).sort()).toEqual([daysAgo(1), todayKey()].sort())
  })

  it('取消周一，周二仍然完成（不串日）', async () => {
    const { app, cookie } = await setup()
    const id = await createDaily(app, cookie)
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })
    await patch(app, cookie, id, { completed: true, doneDate: todayKey() })

    const res = await patch(app, cookie, id, { completed: false, doneDate: daysAgo(1) })
    expect(res.statusCode).toBe(200)

    const task = await getTask(app, cookie, id)
    expect(task.completions.map((c) => c.date)).toEqual([todayKey()])
  })

  it('历史持久化：昨天完成，今天重新加载仍能看到昨天记录', async () => {
    const { app, cookie } = await setup()
    const id = await createDaily(app, cookie)
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })

    // 模拟第二天刷新：重新 GET /api/data
    const task = await getTask(app, cookie, id)
    expect(task.completions).toEqual([{ date: daysAgo(1), completedAmount: 30, contributed: 30 }])
    expect(task.completed).toBe(false) // 兼容视角：今天未完成
  })

  it('贡献一致性：周一 20 + 周二 30 = 50，取消周一后为 30', async () => {
    const { app, cookie, db } = await setup()
    const id = await createDaily(app, cookie, { amount: 20 })

    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1), completedAmount: 20 })
    await patch(app, cookie, id, { completed: true, doneDate: todayKey(), completedAmount: 30 })
    expect(subjectCompleted(db)).toBe(50)

    await patch(app, cookie, id, { completed: false, doneDate: daysAgo(1) })
    expect(subjectCompleted(db)).toBe(30)

    const task = await getTask(app, cookie, id)
    expect(task.completions).toEqual([{ date: todayKey(), completedAmount: 30, contributed: 30 }])
  })

  it('重复完成幂等：不重复累计，也不报错', async () => {
    const { app, cookie, db } = await setup()
    const id = await createDaily(app, cookie)

    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })
    expect(subjectCompleted(db)).toBe(30)
    const task = await getTask(app, cookie, id)
    expect(task.completions).toHaveLength(1)
  })

  it('重复取消幂等：不重复扣减', async () => {
    const { app, cookie, db } = await setup()
    const id = await createDaily(app, cookie)
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })
    expect(subjectCompleted(db)).toBe(30)

    await patch(app, cookie, id, { completed: false, doneDate: daysAgo(1) })
    await patch(app, cookie, id, { completed: false, doneDate: daysAgo(1) })
    expect(subjectCompleted(db)).toBe(0)
  })

  it('删除任务：撤销所有历史完成记录的贡献并删除完成记录', async () => {
    const { app, cookie, db } = await setup()
    const id = await createDaily(app, cookie)
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(2) })
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })
    await patch(app, cookie, id, { completed: true, doneDate: todayKey() })
    expect(subjectCompleted(db)).toBe(90)

    const res = await authedRequest(app, cookie, 'DELETE', `/api/tasks/${id}`)
    expect(res.statusCode).toBe(200)
    expect(subjectCompleted(db)).toBe(0)
    const rows = db.prepare(`SELECT COUNT(*) c FROM task_completions WHERE task_id = ?`).get(id) as {
      c: number
    }
    expect(rows.c).toBe(0)
  })

  it('改科目后历史贡献仍归属原科目', async () => {
    const { app, cookie, db } = await setup()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s2','政治','题',1000,0)`,
    ).run()
    const id = await createDaily(app, cookie, { amount: 20 })
    await patch(app, cookie, id, { completed: true, doneDate: daysAgo(1) })

    // 任务改到政治（历史记录仍归属英语）
    await patch(app, cookie, id, { subjectId: 's2' })
    // 取消周一：撤销英语的 20，政治不变
    await patch(app, cookie, id, { completed: false, doneDate: daysAgo(1) })
    expect(subjectCompleted(db, 's1')).toBe(0)
    expect(subjectCompleted(db, 's2')).toBe(0)
  })

  it('实际完成量：补录历史日期按填写的实际量累计', async () => {
    const { app, cookie, db } = await setup()
    const id = await createDaily(app, cookie, { amount: 50 })
    const res = await patch(app, cookie, id, {
      completed: true,
      doneDate: daysAgo(1),
      completedAmount: 35,
    })
    expect(res.json().task.completions[0].completedAmount).toBe(35)
    expect(subjectCompleted(db)).toBe(35)
  })

  it('普通任务原有行为不变（completed/contributed/completed_amount）', async () => {
    const { app, cookie, db } = await setup()
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '普通任务',
      date: todayKey(),
      subjectId: 's1',
      amount: 20,
    })
    const id = created.json().task.id as string
    const done = await patch(app, cookie, id, { completed: true, completedAmount: 15 })
    expect(done.json().task.completed).toBe(true)
    expect(done.json().task.contributed).toBe(15)
    expect(done.json().task.completedAmount).toBe(15)
    expect(subjectCompleted(db)).toBe(15)

    const undone = await patch(app, cookie, id, { completed: false })
    expect(undone.json().task.completed).toBe(false)
    expect(subjectCompleted(db)).toBe(0)
  })
})

describe('schema v4 -> v6 迁移', () => {
  it('done_date 完成记录迁移为 task_completions，daily 迁移为 weekdays，迁移幂等', () => {
    const db = openDatabase(':memory:')
    // 构造 v4 形态：删除新表/新列并回退版本号
    db.exec(`DROP TABLE task_completions`)
    db.exec(`ALTER TABLE tasks DROP COLUMN weekdays`)
    db.pragma('user_version = 4')
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',100,30)`,
    ).run()
    db.prepare(
      `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed, daily, done_date)
       VALUES ('t1','每日背单词','2026-11-10',1,'s1',30,30,1,'2026-11-10')`,
    ).run()

    migrate(db)
    expect(db.pragma('user_version', { simple: true })).toBe(6)
    const row = db.prepare(`SELECT * FROM task_completions WHERE task_id = 't1'`).get() as {
      date: string
      completed_amount: number | null
      contributed: number
      subject_id: string | null
    }
    expect(row.date).toBe('2026-11-10')
    expect(row.contributed).toBe(30)
    expect(row.subject_id).toBe('s1')

    // daily=1 迁移为 weekdays 全选（127）
    const task = db.prepare(`SELECT weekdays FROM tasks WHERE id = 't1'`).get() as {
      weekdays: number
    }
    expect(task.weekdays).toBe(127)

    // 再次迁移不重复
    migrate(db)
    const count = db.prepare(`SELECT COUNT(*) c FROM task_completions`).get() as { c: number }
    expect(count.c).toBe(1)
    db.close()
  })

  it('无 done_date 的星期任务不生成历史记录', () => {
    const db = openDatabase(':memory:')
    db.exec(`DROP TABLE task_completions`)
    db.exec(`ALTER TABLE tasks DROP COLUMN weekdays`)
    db.pragma('user_version = 4')
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',100,0)`,
    ).run()
    db.prepare(
      `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed, daily, done_date)
       VALUES ('t1','每日背单词','2026-11-10',0,'s1',30,0,1,NULL)`,
    ).run()

    migrate(db)
    const count = db.prepare(`SELECT COUNT(*) c FROM task_completions`).get() as { c: number }
    expect(count.c).toBe(0)
    db.close()
  })
})
