import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

const KEY = 'test-agent-key'

function agentApp(apiKey = KEY) {
  return createTestApp({ agentApiKey: apiKey })
}

function todayKey(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

describe('Agent 开放接口：认证', () => {
  it('未配置 Key 时返回 503', async () => {
    const { app } = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/agent/stats' })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toContain('未启用')
  })

  it('缺少 Key 返回 401', async () => {
    const { app } = agentApp()
    const res = await app.inject({ method: 'GET', url: '/api/agent/stats' })
    expect(res.statusCode).toBe(401)
  })

  it('错误 Key 返回 401', async () => {
    const { app } = agentApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/stats',
      headers: { 'x-agent-key': 'wrong-key' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('正确 Key（Bearer 或 X-Agent-Key）可访问', async () => {
    const { app } = agentApp()
    const bearer = await app.inject({
      method: 'GET',
      url: '/api/agent/stats',
      headers: { authorization: `Bearer ${KEY}` },
    })
    expect(bearer.statusCode).toBe(200)
    const xKey = await app.inject({
      method: 'GET',
      url: '/api/agent/stats',
      headers: { 'x-agent-key': KEY },
    })
    expect(xKey.statusCode).toBe(200)
  })
})

describe('Agent 开放接口：添加任务', () => {
  it('添加任务成功，日期默认今天', async () => {
    const { app } = agentApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/tasks',
      headers: { 'x-agent-key': KEY },
      payload: { title: 'Agent 创建的任务' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().task.title).toBe('Agent 创建的任务')
    expect(res.json().task.date).toBe(todayKey())
    expect(res.json().task.completed).toBe(false)
  })

  it('支持科目、背诵量与每日任务标记', async () => {
    const { app, db } = agentApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',100,0)`,
    ).run()
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/tasks',
      headers: { 'x-agent-key': KEY },
      payload: { title: '背单词', subjectId: 's1', amount: 30, daily: true },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().task.subjectId).toBe('s1')
    expect(res.json().task.amount).toBe(30)
    expect(res.json().task.daily).toBe(true)
  })

  it('校验失败返回 400（空标题 / 不存在科目 / 负背诵量 / 非法日期）', async () => {
    const { app, db } = agentApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',100,0)`,
    ).run()
    const cases: Array<Record<string, unknown>> = [
      { title: '' },
      { title: 'x', subjectId: 'no-such' },
      { title: 'x', subjectId: 's1', amount: -1 },
      { title: 'x', date: '2025-13-40' },
    ]
    for (const payload of cases) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agent/tasks',
        headers: { 'x-agent-key': KEY },
        payload,
      })
      expect(res.statusCode).toBe(400)
    }
  })
})

describe('Agent 开放接口：完成度统计', () => {
  it('stats 返回今日/本周/科目/考试结构', async () => {
    const { app, db } = agentApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',100,20)`,
    ).run()
    const today = todayKey()
    db.prepare(
      `INSERT INTO tasks (id,title,date,completed,subject_id,amount,contributed,daily,done_date)
       VALUES ('t1','任务1',?,1,'s1',10,10,0,NULL)`,
    ).run(today)
    db.prepare(
      `INSERT INTO tasks (id,title,date,completed,subject_id,amount,contributed,daily,done_date)
       VALUES ('t2','任务2',?,0,NULL,NULL,0,0,NULL)`,
    ).run(today)

    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/stats',
      headers: { 'x-agent-key': KEY },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.today.total).toBe(2)
    expect(body.today.done).toBe(1)
    expect(body.today.rate).toBe(50)
    expect(body.today.bySubject).toEqual([{ subjectId: 's1', name: '英语', done: 1, total: 1 }])
    expect(body.week.days).toHaveLength(7)
    expect(body.subjects[0].rate).toBe(20)
    expect(body.exam).toHaveProperty('daysLeft')
  })

  it('tasks 列表接口返回当天任务', async () => {
    const { app, db } = agentApp()
    db.prepare(
      `INSERT INTO tasks (id,title,date,completed,subject_id,amount,contributed,daily,done_date)
       VALUES ('t1','任务',?,1,NULL,NULL,0,0,NULL)`,
    ).run(todayKey())
    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/tasks',
      headers: { 'x-agent-key': KEY },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().tasks).toHaveLength(1)
    expect(res.json().tasks[0].completed).toBe(true)
  })
})

describe('Agent 开放接口：打勾与删除', () => {
  function daysAgo(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const p = (x: number) => (x < 10 ? `0${x}` : String(x))
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  function subjectCompleted(db: ReturnType<typeof createTestApp>['db'], id = 's1'): number {
    return (db.prepare(`SELECT completed FROM subjects WHERE id = ?`).get(id) as { completed: number })
      .completed
  }

  async function setup() {
    const { app, db } = agentApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1','英语','单词',1000,0)`,
    ).run()
    return { app, db }
  }

  async function createTask(
    app: Awaited<ReturnType<typeof setup>>['app'],
    kind: 'daily' | 'normal',
    opts: { amount?: number } = {},
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/tasks',
      headers: { 'x-agent-key': KEY },
      payload: {
        title: '任务',
        date: daysAgo(3),
        subjectId: 's1',
        amount: opts.amount ?? 10,
        daily: kind === 'daily',
      },
    })
    return res.json().task.id as string
  }

  function complete(
    app: Awaited<ReturnType<typeof setup>>['app'],
    id: string,
    payload: Record<string, unknown>,
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/agent/tasks/${id}/complete`,
      headers: { 'x-agent-key': KEY },
      payload,
    })
  }

  it('打勾普通任务：记录实际完成量并累计贡献', async () => {
    const { app, db } = await setup()
    const id = await createTask(app, 'normal')

    const res = await complete(app, id, { completed: true, completedAmount: 8 })
    expect(res.statusCode).toBe(200)
    expect(res.json().task.completed).toBe(true)
    expect(res.json().task.contributed).toBe(8)
    expect(subjectCompleted(db)).toBe(8)
  })

  it('打勾每日任务：按指定日期记录，取消只影响该天', async () => {
    const { app, db } = await setup()
    const id = await createTask(app, 'daily')

    // 补录昨天
    const r1 = await complete(app, id, { doneDate: daysAgo(1), completedAmount: 6 })
    expect(r1.json().task.completions.map((c: { date: string }) => c.date)).toEqual([daysAgo(1)])
    // 今天
    const r2 = await complete(app, id, { doneDate: todayKey() })
    expect(r2.json().task.completions).toHaveLength(2)
    expect(subjectCompleted(db)).toBe(16)
    // 取消昨天
    const r3 = await complete(app, id, { completed: false, doneDate: daysAgo(1) })
    expect(r3.json().task.completions.map((c: { date: string }) => c.date)).toEqual([todayKey()])
    expect(subjectCompleted(db)).toBe(10)
  })

  it('重复打勾幂等：不重复累计', async () => {
    const { app, db } = await setup()
    const id = await createTask(app, 'daily')

    await complete(app, id, {})
    await complete(app, id, {})
    await complete(app, id, {})
    expect(subjectCompleted(db)).toBe(10)
    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/tasks',
      headers: { 'x-agent-key': KEY },
    })
    const task = res.json().tasks.find((t: { id: string }) => t.id === id)
    expect(task.completed).toBe(true)
  })

  it('删除任务：撤销贡献并从列表中移除', async () => {
    const { app, db } = await setup()
    const id = await createTask(app, 'normal')
    await complete(app, id, { completed: true, completedAmount: 12 })
    expect(subjectCompleted(db)).toBe(12)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/agent/tasks/${id}`,
      headers: { 'x-agent-key': KEY },
    })
    expect(del.statusCode).toBe(200)
    expect(subjectCompleted(db)).toBe(0)

    const list = await app.inject({
      method: 'GET',
      url: '/api/agent/tasks',
      headers: { 'x-agent-key': KEY },
    })
    expect(list.json().tasks.find((t: { id: string }) => t.id === id)).toBeUndefined()
  })

  it('新接口同样需要认证：未带 Key 返回 401', async () => {
    const { app } = agentApp()
    const done = await app.inject({ method: 'POST', url: '/api/agent/tasks/x/complete' })
    expect(done.statusCode).toBe(401)
    const del = await app.inject({ method: 'DELETE', url: '/api/agent/tasks/x' })
    expect(del.statusCode).toBe(401)
  })
})
