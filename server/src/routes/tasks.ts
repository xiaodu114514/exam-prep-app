import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { DB, SubjectRow, TaskRow } from '../db'
import { badRequest, notFound } from '../errors'
import { optionalNumber, optionalString, requireDateKey, requireString } from '../validation'
import { computeCompletion, computeRevoke } from '../domain'
import { toSubjectDto, toTaskDto, todayKeyLocal } from './shared'

export type AuthPreHandler = (req: FastifyRequest) => Promise<void>

export interface TaskPatch {
  title?: string
  date?: string
  completed?: boolean
  subjectId?: string | null
  amount?: number | null
  daily?: boolean
}

interface NextTaskState {
  title: string
  date: string
  completed: 0 | 1
  subject_id: string | null
  amount: number | null
  daily: 0 | 1
  done_date: string | null
}

function findTask(db: DB, id: string): TaskRow | undefined {
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined
}

function findSubject(db: DB, id: string | null): SubjectRow | undefined {
  if (!id) return undefined
  return db
    .prepare(`SELECT id, name, unit, total, completed FROM subjects WHERE id = ?`)
    .get(id) as SubjectRow | undefined
}

function ensureSubjectExists(db: DB, id: string): void {
  if (!findSubject(db, id)) throw badRequest('所选科目不存在')
}

/** 校验背诵量：必须 > 0 且必须关联科目 */
function parseAmount(amount: number | null, subjectId: string | null): number | null {
  if (amount === null) return null
  if (amount <= 0) throw badRequest('背诵量必须是大于 0 的数字')
  if (!subjectId) throw badRequest('填写背诵量时必须选择科目')
  return amount
}

/** 任务在“今天”的有效完成态与有效贡献（每日任务以 done_date 判断） */
function effectiveState(t: TaskRow, today: string): { done: boolean; contributed: number } {
  if (t.daily === 1) {
    const done = t.done_date === today
    return { done, contributed: done ? t.contributed : 0 }
  }
  const done = t.completed === 1
  return { done, contributed: done ? t.contributed : 0 }
}

export function registerTaskRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  app.post('/api/tasks', { preHandler: auth }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const title = requireString(body.title, '任务名称')
    const date = requireDateKey(body.date)
    const subjectId = optionalString(body.subjectId)
    if (subjectId) ensureSubjectExists(db, subjectId)
    const amount = parseAmount(optionalNumber(body.amount, '背诵量'), subjectId)
    const daily = body.daily === true ? 1 : 0

    const id = randomUUID()
    db.prepare(
      `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed, daily, done_date)
       VALUES (?, ?, ?, 0, ?, ?, 0, ?, NULL)`,
    ).run(id, title, date, subjectId, amount, daily)
    const row = findTask(db, id)!
    return reply.status(201).send({ task: toTaskDto(row) })
  })

  /**
   * 更新任务（含背诵联动，全部在事务中）：
   * 1) 撤销旧有效贡献（每日任务只撤销“今天”的贡献）
   * 2) 应用新字段（含 daily 转换、done_date 维护）
   * 3) 按新状态重新计算贡献
   */
  const patchTask = db.transaction((id: string, patch: TaskPatch) => {
    const old = findTask(db, id)
    if (!old) throw notFound('任务不存在')
    const today = todayKeyLocal()

    // 1) 撤销旧有效贡献
    const oldState = effectiveState(old, today)
    if (oldState.done && old.subject_id) {
      const oldSubject = findSubject(db, old.subject_id)
      if (oldSubject) {
        const { completed } = computeRevoke(oldSubject, oldState.contributed)
        db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(completed, oldSubject.id)
      }
    }

    // 2) 计算新状态
    let nextDaily = old.daily as 0 | 1
    let nextDoneDate = old.done_date
    let nextCompleted = old.completed as 0 | 1

    if (patch.daily !== undefined) {
      if (patch.daily && old.daily === 0) {
        // 普通 -> 每日：重置为“今天未完成”
        nextDaily = 1
        nextDoneDate = null
        nextCompleted = 0
      } else if (!patch.daily && old.daily === 1) {
        // 每日 -> 普通：保留“今天是否完成”
        nextDaily = 0
        nextCompleted = old.done_date === today ? 1 : 0
        nextDoneDate = null
      } else {
        nextDaily = patch.daily ? 1 : 0
      }
    }

    if (patch.completed !== undefined) {
      if (nextDaily === 1) {
        if (patch.completed) {
          // 勾选每日任务：记录今天（重复勾选幂等）
          if (nextDoneDate !== today) {
            nextDoneDate = today
            nextCompleted = 1
          }
        } else {
          nextDoneDate = null
          nextCompleted = 0
        }
      } else {
        nextCompleted = patch.completed ? 1 : 0
      }
    }

    const next: NextTaskState = {
      title: patch.title !== undefined ? patch.title : old.title,
      date: patch.date !== undefined ? patch.date : old.date,
      completed: nextCompleted,
      subject_id: patch.subjectId !== undefined ? patch.subjectId : old.subject_id,
      amount: patch.amount !== undefined ? patch.amount : old.amount,
      daily: nextDaily,
      done_date: nextDoneDate,
    }
    if (next.subject_id && next.subject_id !== old.subject_id) ensureSubjectExists(db, next.subject_id)

    // 3) 应用新贡献
    const newDone = next.daily === 1 ? next.done_date === today : next.completed === 1
    let contributed = 0
    if (newDone && next.subject_id && next.amount && next.amount > 0) {
      const subject = findSubject(db, next.subject_id)
      if (subject) {
        const res = computeCompletion(subject, next.amount)
        contributed = res.contributed
        db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(res.completed, subject.id)
      }
    }

    db.prepare(
      `UPDATE tasks SET title=?, date=?, completed=?, subject_id=?, amount=?, contributed=?, daily=?, done_date=? WHERE id=?`,
    ).run(
      next.title,
      next.date,
      next.completed,
      next.subject_id,
      next.amount,
      contributed,
      next.daily,
      next.done_date,
      id,
    )

    const updated = findTask(db, id)!
    const affected = next.subject_id ? findSubject(db, next.subject_id) : undefined
    return { task: toTaskDto(updated), subject: affected ? toSubjectDto(affected) : null }
  })

  app.patch('/api/tasks/:id', { preHandler: auth }, async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const { id } = req.params as { id: string }
    const patch: TaskPatch = {}

    if (body.title !== undefined) patch.title = requireString(body.title, '任务名称')
    if (body.date !== undefined) patch.date = requireDateKey(body.date)
    if (body.completed !== undefined) {
      if (typeof body.completed !== 'boolean') throw badRequest('completed 必须是布尔值')
      patch.completed = body.completed
    }
    if (body.subjectId !== undefined) patch.subjectId = optionalString(body.subjectId)
    if (body.amount !== undefined) patch.amount = optionalNumber(body.amount, '背诵量')
    if (body.daily !== undefined) {
      if (typeof body.daily !== 'boolean') throw badRequest('daily 必须是布尔值')
      patch.daily = body.daily
    }

    // 背诵量校验需要考虑“本请求是否会改变科目”
    if (patch.amount !== undefined || patch.subjectId !== undefined) {
      const old = findTask(db, id)
      const effectiveSubjectId =
        patch.subjectId !== undefined ? patch.subjectId : (old?.subject_id ?? null)
      if (effectiveSubjectId) ensureSubjectExists(db, effectiveSubjectId)
      if (patch.amount !== undefined) parseAmount(patch.amount, effectiveSubjectId)
    }

    return patchTask(id, patch)
  })

  const deleteTask = db.transaction((id: string) => {
    const old = findTask(db, id)
    if (!old) throw notFound('任务不存在')
    const oldState = effectiveState(old, todayKeyLocal())
    if (oldState.done && old.subject_id) {
      const subject = findSubject(db, old.subject_id)
      if (subject) {
        const { completed } = computeRevoke(subject, oldState.contributed)
        db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(completed, subject.id)
      }
    }
    db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id)
  })

  app.delete('/api/tasks/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    deleteTask(id)
    return { ok: true }
  })
}
