import type { FastifyInstance } from 'fastify'
import type { DB } from '../db'
import { badRequest } from '../errors'
import { readAllData } from './data'
import type { AuthPreHandler } from './tasks'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

function todayKey(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface ImportedSubject {
  id: string
  name: string
  unit: string
  total: number
  completed: number
}

export interface ImportedSite {
  id: string
  name: string
  url: string
}

export interface ImportedTask {
  id: string
  title: string
  date: string
  completed: boolean
  subjectId: string | null
  amount: number | null
  contributed: number
  daily: boolean
  doneDate: string | null
}

export interface ImportedData {
  exam: { name: string; date: string }
  subjects: ImportedSubject[]
  sites: ImportedSite[]
  tasks: ImportedTask[]
}

export type NormalizeResult = { ok: true; data: ImportedData } | { ok: false; error: string }

/**
 * 服务端导入校验与规范化（与前端 normalizeData 规则一致，另加引用完整性检查）：
 * - 结构缺失 / 任务引用不存在的科目 -> 拒绝导入；
 * - 字段级问题补齐默认值（旧版本数据兼容）；
 * - 完成状态任务按 amount 记录 contributed（前端旧数据无此字段，取 amount 为最佳近似）。
 */
export function normalizeImport(raw: unknown): NormalizeResult {
  if (!isRecord(raw)) return { ok: false, error: '数据格式不正确' }
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.tasks) || !Array.isArray(raw.sites)) {
    return { ok: false, error: '数据缺少必要的字段（tasks / subjects / sites）' }
  }

  let examName = '我的考试'
  let examDate = todayKey()
  if (isRecord(raw.exam)) {
    if (typeof raw.exam.name === 'string' && raw.exam.name.trim() !== '') examName = raw.exam.name.trim()
    if (typeof raw.exam.date === 'string' && DATE_RE.test(raw.exam.date)) examDate = raw.exam.date
  }

  const subjects: ImportedSubject[] = []
  const subjectIds = new Set<string>()
  for (const item of raw.subjects) {
    if (!isRecord(item)) continue
    const id =
      typeof item.id === 'string' && item.id !== '' ? item.id : `subj_imported_${subjects.length + 1}`
    if (subjectIds.has(id)) return { ok: false, error: `科目 id 重复：${id}` }
    subjectIds.add(id)
    const total =
      typeof item.total === 'number' && Number.isFinite(item.total) && item.total > 0 ? item.total : 1
    const rawCompleted =
      typeof item.completed === 'number' && Number.isFinite(item.completed) && item.completed >= 0
        ? item.completed
        : 0
    subjects.push({
      id,
      name: typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim() : '未命名科目',
      unit: typeof item.unit === 'string' && item.unit.trim() !== '' ? item.unit.trim() : '项',
      total,
      completed: Math.min(total, rawCompleted),
    })
  }

  const sites: ImportedSite[] = []
  for (const item of raw.sites) {
    if (!isRecord(item)) continue
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (url === '') continue // 无地址的网站条目跳过
    sites.push({
      id: typeof item.id === 'string' && item.id !== '' ? item.id : `site_imported_${sites.length + 1}`,
      name: typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim() : '未命名网站',
      url,
    })
  }

  const tasks: ImportedTask[] = []
  for (const item of raw.tasks) {
    if (!isRecord(item)) continue
    const subjectId = typeof item.subjectId === 'string' && item.subjectId !== '' ? item.subjectId : null
    if (subjectId && !subjectIds.has(subjectId)) {
      const title = typeof item.title === 'string' ? item.title : '未命名'
      return { ok: false, error: `任务「${title}」引用了不存在的科目，请先补全科目数据再导入` }
    }
    const daily = item.daily === true
    const doneDate =
      daily && typeof item.doneDate === 'string' && DATE_RE.test(item.doneDate) ? item.doneDate : null
    // 每日任务：完成态以 doneDate 是否为今天决定；普通任务沿用 completed 字段
    const completed = daily ? doneDate === todayKey() : item.completed === true
    const amount =
      typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount > 0
        ? item.amount
        : null
    tasks.push({
      id: typeof item.id === 'string' && item.id !== '' ? item.id : `task_imported_${tasks.length + 1}`,
      title: typeof item.title === 'string' && item.title.trim() !== '' ? item.title.trim() : '未命名任务',
      date: typeof item.date === 'string' && DATE_RE.test(item.date) ? item.date : todayKey(),
      completed,
      subjectId,
      amount,
      contributed: completed && subjectId && amount !== null ? amount : 0,
      daily,
      doneDate,
    })
  }

  return {
    ok: true,
    data: { exam: { name: examName, date: examDate }, subjects, sites, tasks },
  }
}

export function registerImportExportRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  app.get('/api/data/export', { preHandler: auth }, async (_req, reply) => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return reply
      .header('Content-Disposition', `attachment; filename="exam-prep-backup-${stamp}.json"`)
      .type('application/json')
      .send(JSON.stringify(readAllData(db), null, 2))
  })

  /**
   * 导入流程（修订 5）：
   * 1) 先完整校验（normalizeImport），校验失败直接 400，数据库零改动；
   * 2) 校验通过后在单事务内：先自动备份当前数据到 data_backups，再替换全部业务数据；
   * 3) 任何一步失败整体回滚，已有数据与备份均不受影响。
   */
  const importTx = db.transaction((data: ImportedData): number => {
    const backup = db
      .prepare(`INSERT INTO data_backups (payload) VALUES (?)`)
      .run(JSON.stringify(readAllData(db), null, 2))
    const backupId = Number(backup.lastInsertRowid)

    db.prepare(`DELETE FROM tasks`).run()
    db.prepare(`DELETE FROM subjects`).run()
    db.prepare(`DELETE FROM sites`).run()
    db.prepare(`UPDATE exam SET name = ?, date = ? WHERE id = 1`).run(data.exam.name, data.exam.date)

    const insSubject = db.prepare(
      `INSERT INTO subjects (id, name, unit, total, completed) VALUES (?, ?, ?, ?, ?)`,
    )
    for (const s of data.subjects) insSubject.run(s.id, s.name, s.unit, s.total, s.completed)

    const insSite = db.prepare(`INSERT INTO sites (id, name, url) VALUES (?, ?, ?)`)
    for (const s of data.sites) insSite.run(s.id, s.name, s.url)

    const insTask = db.prepare(
      `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed, daily, done_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const t of data.tasks) {
      insTask.run(
        t.id,
        t.title,
        t.date,
        t.completed ? 1 : 0,
        t.subjectId,
        t.amount,
        t.contributed,
        t.daily ? 1 : 0,
        t.doneDate,
      )
    }
    return backupId
  })

  app.post('/api/data/import', { preHandler: auth }, async (req) => {
    const result = normalizeImport(req.body as unknown)
    if (!result.ok) throw badRequest(`导入失败：${result.error}`)
    const backupId = importTx(result.data)
    return {
      imported: {
        tasks: result.data.tasks.length,
        subjects: result.data.subjects.length,
        sites: result.data.sites.length,
      },
      backupId,
    }
  })
}
