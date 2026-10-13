import type { FastifyInstance } from 'fastify'
import type { DB, ExamRow, SiteRow, SubjectRow, TaskRow } from '../db'
import { toSiteDto, toSubjectDto, toTaskDto } from './shared'
import type { AuthPreHandler } from './tasks'

/** 读取全量业务数据（与前端 AppData 形状一致，version: 1） */
export function readAllData(db: DB) {
  const exam = db.prepare(`SELECT id, name, date FROM exam WHERE id = 1`).get() as ExamRow
  const subjects = db
    .prepare(`SELECT id, name, unit, total, completed FROM subjects ORDER BY rowid`)
    .all() as SubjectRow[]
  const sites = db.prepare(`SELECT id, name, url FROM sites ORDER BY rowid`).all() as SiteRow[]
  const tasks = db.prepare(`SELECT * FROM tasks ORDER BY rowid`).all() as TaskRow[]

  return {
    version: 1,
    exam: { name: exam.name, date: exam.date },
    subjects: subjects.map(toSubjectDto),
    sites: sites.map(toSiteDto),
    tasks: tasks.map(toTaskDto),
  }
}

export function registerDataRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  app.get('/api/data', { preHandler: auth }, async () => readAllData(db))
}
