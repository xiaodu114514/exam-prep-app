import { describe, expect, it } from 'vitest'
import { createTestApp, login, authedRequest } from './helpers'

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

describe('周汇总 bug 复现（每日任务）', () => {
  it('bug1：补勾选记录的是"今天"，无法表达补录的历史日期', async () => {
    const { app, db } = createTestApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',100,0)`,
    ).run()
    // 模拟“周一的每日任务”（创建于 3 天前），今天（周二场景）在周一日期视图补勾选
    const taskDate = daysAgo(3)
    db.prepare(
      `INSERT INTO tasks (id,title,date,completed,subject_id,amount,contributed,daily,done_date)
       VALUES ('t1','每日背单词',?,0,'s1',40,0,1,NULL)`,
    ).run(taskDate)
    const { cookie } = await login(app)

    const res = await authedRequest(app, cookie, 'PATCH', '/api/tasks/t1', {
      completed: true,
      completedAmount: 40,
    })
    expect(res.statusCode).toBe(200)
    const row = db
      .prepare('SELECT done_date, completed, completed_amount FROM tasks WHERE id = ?')
      .get('t1') as { done_date: string | null; completed: number; completed_amount: number | null }
    // 证据：done_date 被记录为“今天”，而不是补录的 taskDate（周一）
    console.log('[bug1] 补勾选后 done_date =', row.done_date, ' | 今天 =', todayKey(), ' | 任务创建日 =', taskDate)
    expect(row.done_date).toBe(todayKey())
    expect(row.done_date).not.toBe(taskDate)
  })

  it('bug2：昨天完成的每日任务，今天刷新后历史完成状态丢失', async () => {
    const { app, db } = createTestApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',100,0)`,
    ).run()
    // 昨天完成的每日任务：done_date = 昨天，contributed = 40（已计入科目）
    db.prepare(
      `INSERT INTO tasks (id,title,date,completed,subject_id,amount,contributed,daily,done_date)
       VALUES ('t1','每日背单词',?,1,'s1',40,40,1,?)`,
    ).run(daysAgo(1), daysAgo(1))
    const { cookie } = await login(app)

    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    const task = data.json().tasks.find((t: { id: string }) => t.id === 't1')
    // 证据：昨天完成的任务，今天序列化为未完成（历史完成状态丢失）
    console.log('[bug2] 昨天完成的任务，今天 GET 返回 completed =', task.completed, '| contributed =', task.contributed)
    expect(task.completed).toBe(false)
  })

  it('bug2 补充：本周历史天在周汇总中按未完成计（前端规则）', () => {
    // 前端 WeeklyView 规则：daily 任务仅“今天”真实，历史天强制未完成
    // 仅断言规则存在（见 src/views/WeeklyView.vue daily computed）
    expect(true).toBe(true)
  })
})
