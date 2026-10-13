import type { FastifyInstance } from 'fastify'
import type { DB } from '../db'
import { requireDateKey, requireString } from '../validation'
import type { AuthPreHandler } from './tasks'

export function registerExamRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  app.put('/api/exam', { preHandler: auth }, async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const name = requireString(body.name, '考试名称')
    const date = requireDateKey(body.date, '考试日期')
    db.prepare(`UPDATE exam SET name = ?, date = ? WHERE id = 1`).run(name, date)
    return { exam: { name, date } }
  })
}
