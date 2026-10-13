import { describe, expect, it } from 'vitest'
import { createTestApp, login, authedRequest } from './helpers'
import type { DB } from '../src/db'

function seedData(db: DB) {
  db.prepare(
    `INSERT INTO subjects (id, name, unit, total, completed) VALUES ('s1', '英语', '单词', 100, 50)`,
  ).run()
  db.prepare(`INSERT INTO sites (id, name, url) VALUES ('w1', '粉笔', 'https://fenbi.com')`).run()
  db.prepare(
    `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed)
     VALUES ('t1', '背单词', '2025-11-04', 1, 's1', 50, 50)`,
  ).run()
  db.prepare(`UPDATE exam SET name = '公务员考试', date = '2025-12-01' WHERE id = 1`).run()
}

const IMPORT_PAYLOAD = {
  version: 1,
  exam: { name: '研究生考试', date: '2025-12-20' },
  subjects: [{ id: 's2', name: '政治', unit: '知识点', total: 200, completed: 30 }],
  sites: [{ id: 'w2', name: '学习强国', url: 'https://xuexi.cn' }],
  tasks: [
    { id: 't2', title: '背知识点', date: '2025-11-05', completed: true, subjectId: 's2', amount: 20 },
    { id: 't3', title: '复习', date: '2025-11-05', completed: false, subjectId: null, amount: null },
  ],
}

describe('数据导出', () => {
  it('导出内容与数据库一致且带下载文件名', async () => {
    const { app, db } = createTestApp()
    seedData(db)
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'GET', '/api/data/export')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toContain('exam-prep-backup-')
    const data = JSON.parse(res.body)
    expect(data.exam.name).toBe('公务员考试')
    expect(data.subjects).toHaveLength(1)
    expect(data.tasks).toHaveLength(1)
    expect(data.tasks[0].contributed).toBe(50)
  })
})

describe('数据导入：校验、自动备份与事务替换', () => {
  it('合法导入替换全部数据，并自动备份导入前快照', async () => {
    const { app, db } = createTestApp()
    seedData(db)
    const { cookie } = await login(app)

    const res = await authedRequest(app, cookie, 'POST', '/api/data/import', IMPORT_PAYLOAD)
    expect(res.statusCode).toBe(200)
    expect(res.json().imported).toEqual({ tasks: 2, subjects: 1, sites: 1 })
    expect(res.json().backupId).toBeGreaterThan(0)

    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    expect(data.json().exam.name).toBe('研究生考试')
    expect(data.json().subjects).toHaveLength(1)
    expect(data.json().tasks).toHaveLength(2)

    const backups = db.prepare(`SELECT id, payload FROM data_backups`).all() as {
      id: number
      payload: string
    }[]
    expect(backups).toHaveLength(1)
    const snapshot = JSON.parse(backups[0].payload)
    expect(snapshot.exam.name).toBe('公务员考试')
    expect(snapshot.subjects[0].id).toBe('s1')
    expect(snapshot.tasks[0].id).toBe('t1')
  })

  it('任务引用不存在的科目：导入被拒绝，原数据与备份零改动', async () => {
    const { app, db } = createTestApp()
    seedData(db)
    const { cookie } = await login(app)

    const bad = {
      ...IMPORT_PAYLOAD,
      tasks: [
        {
          id: 'tx',
          title: '孤儿任务',
          date: '2025-11-05',
          completed: false,
          subjectId: 'ghost',
          amount: 10,
        },
      ],
    }
    const res = await authedRequest(app, cookie, 'POST', '/api/data/import', bad)
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('不存在的科目')

    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    expect(data.json().exam.name).toBe('公务员考试')
    expect(data.json().subjects[0].id).toBe('s1')
    expect((db.prepare(`SELECT COUNT(*) AS c FROM data_backups`).get() as { c: number }).c).toBe(0)
  })

  it('缺少核心字段返回 400', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'POST', '/api/data/import', { exam: {} })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('缺少必要的字段')
  })

  it('重复导入可再次替换，每次生成新备份', async () => {
    const { app, db } = createTestApp()
    seedData(db)
    const { cookie } = await login(app)
    await authedRequest(app, cookie, 'POST', '/api/data/import', IMPORT_PAYLOAD)
    const second = await authedRequest(app, cookie, 'POST', '/api/data/import', IMPORT_PAYLOAD)
    expect(second.statusCode).toBe(200)
    expect((db.prepare(`SELECT COUNT(*) AS c FROM data_backups`).get() as { c: number }).c).toBe(2)
  })

  it('导入旧版数据（任务无 amount 字段）自动补齐且不产生联动', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const old = {
      version: 1,
      exam: { name: '旧考试', date: '2025-12-20' },
      subjects: [{ id: 's1', name: '英语', unit: '单词', total: 100, completed: 10 }],
      sites: [],
      tasks: [
        { id: 't1', title: '旧任务', date: '2025-11-04', completed: true, subjectId: 's1' },
      ],
    }
    const res = await authedRequest(app, cookie, 'POST', '/api/data/import', old)
    expect(res.statusCode).toBe(200)

    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    const task = data.json().tasks[0]
    expect(task.amount).toBeNull()
    expect(task.contributed).toBe(0)
    expect(data.json().subjects[0].completed).toBe(10)
  })

  it('已完成背诵任务导入时记录 contributed = amount', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'POST', '/api/data/import', IMPORT_PAYLOAD)
    expect(res.statusCode).toBe(200)
    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    const done = data.json().tasks.find((t: { id: string }) => t.id === 't2')
    expect(done.contributed).toBe(20)
  })
})
