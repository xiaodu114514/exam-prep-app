import { describe, expect, it } from 'vitest'
import { createTestApp, login, authedRequest } from './helpers'

/** 建立测试科目（total=100, completed=0）并返回其 id 与 db */
function setupSubject() {
  const ctx = createTestApp()
  const { db } = ctx
  db.prepare(
    `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('subj-test', '英语', '单词', 100, 0)`,
  ).run()
  return { ...ctx, subjectId: 'subj-test' }
}

function subjectCompleted(db: ReturnType<typeof createTestApp>['db'], id: string): number {
  const row = db.prepare(`SELECT completed FROM subjects WHERE id = ?`).get(id) as {
    completed: number
  }
  return row.completed
}

describe('任务接口：输入校验', () => {
  it('空标题 / 非法日期 / 负背诵量 / 无科目背诵量 / 不存在科目 均返回 400', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)

    const cases: Array<[Record<string, unknown>, string]> = [
      [{ title: '', date: '2025-11-04' }, '任务名称'],
      [{ title: 'x', date: '2025-02-30' }, '日期'],
      [{ title: 'x', date: '2025-11-04', amount: -1 }, '背诵量'],
      [{ title: 'x', date: '2025-11-04', amount: 10 }, '必须选择科目'],
      [{ title: 'x', date: '2025-11-04', subjectId: 'no-such' }, '科目不存在'],
    ]
    for (const [payload, keyword] of cases) {
      const res = await authedRequest(app, cookie, 'POST', '/api/tasks', payload)
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain(keyword)
    }
  })

  it('创建任务成功返回 201 且默认未完成', async () => {
    const { app } = setupSubject()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背单词',
      date: '2025-11-04',
      subjectId: 'subj-test',
      amount: 50,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().task.completed).toBe(false)
    expect(res.json().task.contributed).toBe(0)
  })
})

describe('任务接口：背诵联动事务一致性', () => {
  it('勾选完成累计贡献，取消勾选精确回退', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背单词',
      date: '2025-11-04',
      subjectId,
      amount: 50,
    })
    const taskId = created.json().task.id as string

    const done = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, {
      completed: true,
    })
    expect(done.statusCode).toBe(200)
    expect(done.json().task.contributed).toBe(50)
    expect(done.json().subject.completed).toBe(50)
    expect(subjectCompleted(db, subjectId)).toBe(50)

    const undone = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, {
      completed: false,
    })
    expect(undone.statusCode).toBe(200)
    expect(undone.json().task.contributed).toBe(0)
    expect(subjectCompleted(db, subjectId)).toBe(0)
  })

  it('clamp 场景（95+10→100）取消后精确回到 95', async () => {
    const { app, db, subjectId } = setupSubject()
    db.prepare(`UPDATE subjects SET completed = 95 WHERE id = ?`).run(subjectId)
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背单词',
      date: '2025-11-04',
      subjectId,
      amount: 10,
    })
    const taskId = created.json().task.id as string

    const done = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, {
      completed: true,
    })
    expect(done.json().task.contributed).toBe(5)
    expect(subjectCompleted(db, subjectId)).toBe(100)

    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: false })
    expect(subjectCompleted(db, subjectId)).toBe(95)
  })

  it('编辑背诵量 50→30 会重新计算贡献', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背单词',
      date: '2025-11-04',
      subjectId,
      amount: 50,
    })
    const taskId = created.json().task.id as string
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(subjectCompleted(db, subjectId)).toBe(50)

    const edited = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, {
      amount: 30,
    })
    expect(edited.statusCode).toBe(200)
    expect(edited.json().task.contributed).toBe(30)
    expect(subjectCompleted(db, subjectId)).toBe(30)
  })

  it('切换科目：旧科目回退、新科目增加', async () => {
    const { app, db, subjectId } = setupSubject()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('subj-b', '政治', '知识点', 200, 0)`,
    ).run()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背书',
      date: '2025-11-04',
      subjectId,
      amount: 30,
    })
    const taskId = created.json().task.id as string
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(subjectCompleted(db, subjectId)).toBe(30)

    const switched = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, {
      subjectId: 'subj-b',
    })
    expect(switched.statusCode).toBe(200)
    expect(subjectCompleted(db, subjectId)).toBe(0)
    expect(subjectCompleted(db, 'subj-b')).toBe(30)
  })

  it('PATCH 校验失败时事务回滚，科目进度不变', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背单词',
      date: '2025-11-04',
      subjectId,
      amount: 50,
    })
    const taskId = created.json().task.id as string
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(subjectCompleted(db, subjectId)).toBe(50)

    // 事务内校验失败（科目不存在），必须整体回滚
    const res = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, {
      subjectId: 'no-such',
    })
    expect(res.statusCode).toBe(400)
    expect(subjectCompleted(db, subjectId)).toBe(50)
    const task = db.prepare(`SELECT subject_id, completed, contributed FROM tasks WHERE id = ?`).get(
      taskId,
    ) as { subject_id: string | null; completed: number; contributed: number }
    expect(task.subject_id).toBe(subjectId)
    expect(task.completed).toBe(1)
    expect(task.contributed).toBe(50)
  })

  it('删除已完成任务会撤销贡献', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背单词',
      date: '2025-11-04',
      subjectId,
      amount: 50,
    })
    const taskId = created.json().task.id as string
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(subjectCompleted(db, subjectId)).toBe(50)

    const del = await authedRequest(app, cookie, 'DELETE', `/api/tasks/${taskId}`)
    expect(del.statusCode).toBe(200)
    expect(subjectCompleted(db, subjectId)).toBe(0)
  })

  it('删除不存在的任务返回 404', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'DELETE', '/api/tasks/no-such')
    expect(res.statusCode).toBe(404)
  })

  it('重复提交同一 PATCH（幂等）：科目进度与贡献不变', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '背单词',
      date: '2025-11-04',
      subjectId,
      amount: 50,
    })
    const taskId = created.json().task.id as string

    // 第一次勾选
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(subjectCompleted(db, subjectId)).toBe(50)
    // 重复提交相同的 completed=true
    const again = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, {
      completed: true,
    })
    expect(again.statusCode).toBe(200)
    expect(again.json().task.contributed).toBe(50)
    expect(subjectCompleted(db, subjectId)).toBe(50)

    // 重复提交相同的 amount 修改
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { amount: 50 })
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { amount: 50 })
    expect(subjectCompleted(db, subjectId)).toBe(50)

    // 重复取消
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: false })
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: false })
    expect(subjectCompleted(db, subjectId)).toBe(0)
  })
})

describe('每日任务（daily）', () => {
  function localToday(): string {
    const d = new Date()
    const p = (n: number) => (n < 10 ? `0${n}` : String(n))
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  function daysAgo(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const p = (x: number) => (x < 10 ? `0${x}` : String(x))
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  it('创建每日任务：daily=true、默认今天未完成', async () => {
    const { app } = setupSubject()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '每日背单词',
      date: localToday(),
      subjectId: 'subj-test',
      amount: 30,
      daily: true,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().task.daily).toBe(true)
    expect(res.json().task.completed).toBe(false)
    expect(res.json().task.doneDate).toBeNull()
  })

  it('勾选每日任务：累计贡献并记录 doneDate=今天；重复勾选幂等；取消撤销', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '每日背单词',
      date: localToday(),
      subjectId,
      amount: 30,
      daily: true,
    })
    const taskId = created.json().task.id as string

    const done = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(done.json().task.completed).toBe(true)
    expect(done.json().task.doneDate).toBe(localToday())
    expect(done.json().task.contributed).toBe(30)
    expect(subjectCompleted(db, subjectId)).toBe(30)

    const again = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(again.statusCode).toBe(200)
    expect(subjectCompleted(db, subjectId)).toBe(30)

    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: false })
    expect(subjectCompleted(db, subjectId)).toBe(0)
  })

  it('昨天完成的每日任务：今天序列化为未完成、贡献归零', async () => {
    const { app, db } = setupSubject()
    db.prepare(
      `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed, daily, done_date)
       VALUES ('dt1', '每日背单词', ?, 1, 'subj-test', 30, 30, 1, ?)`,
    ).run(daysAgo(1), daysAgo(1))
    const { cookie } = await login(app)
    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    const task = data.json().tasks.find((t: { id: string }) => t.id === 'dt1')
    expect(task.daily).toBe(true)
    expect(task.completed).toBe(false)
    expect(task.contributed).toBe(0)
    expect(task.doneDate).toBe(daysAgo(1))
  })

  it('普通任务转每日任务：重置为今天未完成并撤销贡献', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '普通任务',
      date: localToday(),
      subjectId,
      amount: 20,
    })
    const taskId = created.json().task.id as string
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(subjectCompleted(db, subjectId)).toBe(20)

    const res = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { daily: true })
    expect(res.statusCode).toBe(200)
    expect(res.json().task.daily).toBe(true)
    expect(res.json().task.completed).toBe(false)
    expect(subjectCompleted(db, subjectId)).toBe(0)
  })

  it('每日任务转普通任务：保留今天完成状态', async () => {
    const { app, db, subjectId } = setupSubject()
    const { cookie } = await login(app)
    const created = await authedRequest(app, cookie, 'POST', '/api/tasks', {
      title: '每日背单词',
      date: localToday(),
      subjectId,
      amount: 30,
      daily: true,
    })
    const taskId = created.json().task.id as string
    await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { completed: true })
    expect(subjectCompleted(db, subjectId)).toBe(30)

    const res = await authedRequest(app, cookie, 'PATCH', `/api/tasks/${taskId}`, { daily: false })
    expect(res.json().task.daily).toBe(false)
    expect(res.json().task.completed).toBe(true)
    expect(subjectCompleted(db, subjectId)).toBe(30)
  })
})
