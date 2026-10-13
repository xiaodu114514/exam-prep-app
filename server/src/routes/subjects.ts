import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { DB, SubjectRow } from '../db'
import { badRequest, notFound } from '../errors'
import { optionalNumber, optionalString, requireNumber, requireString } from '../validation'
import { toSubjectDto } from './shared'
import type { AuthPreHandler } from './tasks'

function findSubject(db: DB, id: string): SubjectRow | undefined {
  return db
    .prepare(`SELECT id, name, unit, total, completed FROM subjects WHERE id = ?`)
    .get(id) as SubjectRow | undefined
}

interface SubjectFields {
  name: string
  unit: string
  total: number
  completed: number
}

/** 校验科目数值边界：total > 0，0 <= completed <= total */
function validateBounds(total: number, completed: number): void {
  if (!(total > 0)) throw badRequest('总任务量必须是大于 0 的数字')
  if (completed < 0) throw badRequest('已完成量必须是不小于 0 的数字')
  if (completed > total) throw badRequest('已完成量不能超过总任务量')
}

export function registerSubjectRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  app.post('/api/subjects', { preHandler: auth }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const name = requireString(body.name, '科目名称')
    const unit = optionalString(body.unit) ?? '项'
    const total = requireNumber(body.total, '总任务量')
    const completed = optionalNumber(body.completed, '已完成量') ?? 0
    validateBounds(total, completed)

    const id = randomUUID()
    db.prepare(`INSERT INTO subjects (id, name, unit, total, completed) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      name,
      unit,
      total,
      completed,
    )
    const row = findSubject(db, id)!
    return reply.status(201).send({ subject: toSubjectDto(row) })
  })

  app.patch('/api/subjects/:id', { preHandler: auth }, async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const { id } = req.params as { id: string }
    const old = findSubject(db, id)
    if (!old) throw notFound('科目不存在')

    const fields: Partial<SubjectFields> = {}
    if (body.name !== undefined) fields.name = requireString(body.name, '科目名称')
    if (body.unit !== undefined) fields.unit = optionalString(body.unit) ?? '项'
    if (body.total !== undefined) fields.total = requireNumber(body.total, '总任务量')
    if (body.completed !== undefined) fields.completed = requireNumber(body.completed, '已完成量')

    const effectiveTotal = fields.total ?? old.total
    const effectiveCompleted = fields.completed ?? old.completed
    validateBounds(effectiveTotal, effectiveCompleted)

    db.prepare(`UPDATE subjects SET name=?, unit=?, total=?, completed=? WHERE id=?`).run(
      fields.name ?? old.name,
      fields.unit ?? old.unit,
      effectiveTotal,
      effectiveCompleted,
      id,
    )
    return { subject: toSubjectDto(findSubject(db, id)!) }
  })

  const deleteSubject = db.transaction((id: string) => {
    if (!findSubject(db, id)) throw notFound('科目不存在')
    // 清理关联任务的标签、背诵量与贡献记录
    db.prepare(
      `UPDATE tasks SET subject_id = NULL, amount = NULL, contributed = 0 WHERE subject_id = ?`,
    ).run(id)
    db.prepare(`DELETE FROM subjects WHERE id = ?`).run(id)
  })

  app.delete('/api/subjects/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    deleteSubject(id)
    return { ok: true }
  })
}
