import { describe, expect, it } from 'vitest'
import { createTestApp, login, authedRequest } from './helpers'

describe('科目接口：数值边界校验', () => {
  it('total <= 0 或 completed 越界返回 400', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)

    const cases: Array<[Record<string, unknown>, string]> = [
      [{ name: '高数', unit: '章节', total: 0, completed: 0 }, '大于 0'],
      [{ name: '高数', unit: '章节', total: -5, completed: 0 }, '大于 0'],
      [{ name: '高数', unit: '章节', total: 100, completed: 101 }, '不能超过总任务量'],
      [{ name: '高数', unit: '章节', total: 100, completed: -1 }, '不小于 0'],
      [{ name: '', unit: '章节', total: 100, completed: 0 }, '科目名称'],
    ]
    for (const [payload, keyword] of cases) {
      const res = await authedRequest(app, cookie, 'POST', '/api/subjects', payload)
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain(keyword)
    }
  })

  it('创建成功返回 201，单位留空默认「项」', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'POST', '/api/subjects', {
      name: '高数',
      unit: '',
      total: 100,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().subject.unit).toBe('项')
    expect(res.json().subject.completed).toBe(0)
  })

  it('PATCH 修改 completed 越界返回 400，修改 total 小于当前 completed 返回 400', async () => {
    const { app, db } = createTestApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1', '英语', '单词', 100, 40)`,
    ).run()
    const { cookie } = await login(app)

    const over = await authedRequest(app, cookie, 'PATCH', '/api/subjects/s1', { completed: 101 })
    expect(over.statusCode).toBe(400)
    expect(over.json().error).toContain('不能超过总任务量')

    const shrink = await authedRequest(app, cookie, 'PATCH', '/api/subjects/s1', { total: 30 })
    expect(shrink.statusCode).toBe(400)
    expect(shrink.json().error).toContain('不能超过总任务量')

    const ok = await authedRequest(app, cookie, 'PATCH', '/api/subjects/s1', { completed: 60 })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().subject.completed).toBe(60)
  })

  it('删除科目会清理关联任务的标签、背诵量与贡献记录', async () => {
    const { app, db } = createTestApp()
    db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1', '英语', '单词', 100, 50)`,
    ).run()
    db.prepare(
      `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed)
       VALUES ('t1', '背单词', '2025-11-04', 1, 's1', 50, 50)`,
    ).run()
    const { cookie } = await login(app)

    const del = await authedRequest(app, cookie, 'DELETE', '/api/subjects/s1')
    expect(del.statusCode).toBe(200)

    const task = db.prepare(`SELECT subject_id, amount, contributed FROM tasks WHERE id = 't1'`).get() as {
      subject_id: string | null
      amount: number | null
      contributed: number
    }
    expect(task.subject_id).toBeNull()
    expect(task.amount).toBeNull()
    expect(task.contributed).toBe(0)
  })
})

describe('考试信息接口', () => {
  it('更新考试信息并校验输入', async () => {
    const { app, db } = createTestApp()
    const { cookie } = await login(app)

    const bad = await authedRequest(app, cookie, 'PUT', '/api/exam', {
      name: '',
      date: '2025-12-20',
    })
    expect(bad.statusCode).toBe(400)

    const badDate = await authedRequest(app, cookie, 'PUT', '/api/exam', {
      name: '研究生考试',
      date: '2025-13-40',
    })
    expect(badDate.statusCode).toBe(400)

    const ok = await authedRequest(app, cookie, 'PUT', '/api/exam', {
      name: '研究生考试',
      date: '2025-12-20',
    })
    expect(ok.statusCode).toBe(200)
    const row = db.prepare(`SELECT name, date FROM exam WHERE id = 1`).get() as {
      name: string
      date: string
    }
    expect(row).toEqual({ name: '研究生考试', date: '2025-12-20' })
  })
})
