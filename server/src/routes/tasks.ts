import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { CompletionRow, DB, SubjectRow, TaskRow } from '../db'
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
  /** 完成时填写的实际完成量（可选，默认使用计划量） */
  completedAmount?: number | null
  /** 每日任务：完成/取消的日期（YYYY-MM-DD，默认今天） */
  doneDate?: string
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

/** 以增量调整科目已完成量（限制在 [0, total]） */
function shiftSubject(db: DB, subjectId: string, delta: number): void {
  const subject = findSubject(db, subjectId)
  if (!subject) return
  const next = Math.min(subject.total, Math.max(0, subject.completed + delta))
  db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(next, subjectId)
}

function findCompletion(db: DB, taskId: string, date: string): CompletionRow | undefined {
  return db
    .prepare(`SELECT * FROM task_completions WHERE task_id = ? AND date = ?`)
    .get(taskId, date) as CompletionRow | undefined
}

function listCompletions(db: DB, taskId: string): CompletionRow[] {
  return db
    .prepare(`SELECT * FROM task_completions WHERE task_id = ? ORDER BY date`)
    .all(taskId) as CompletionRow[]
}

/**
 * 每日任务完成某一天（幂等）：
 * - 无记录：按实际完成量计算贡献并写入；
 * - 已有记录且未指定新完成量：幂等，不重复累计；
 * - 已有记录且指定了新完成量：先撤销旧贡献再按新值重算。
 * 返回受影响的科目 id（无科目时 null）。
 */
function completeDailyOn(db: DB, task: TaskRow, targetDate: string, patch: TaskPatch): string | null {
  const existing = findCompletion(db, task.id, targetDate)
  const wantAmount =
    patch.completedAmount !== undefined
      ? patch.completedAmount
      : (existing?.completed_amount ?? task.amount ?? null)

  if (existing) {
    if (patch.completedAmount === undefined || existing.completed_amount === patch.completedAmount) {
      return existing.subject_id
    }
    if (existing.contributed > 0 && existing.subject_id) {
      shiftSubject(db, existing.subject_id, -existing.contributed)
    }
    let contributed = 0
    if (wantAmount !== null && wantAmount > 0 && existing.subject_id) {
      const subject = findSubject(db, existing.subject_id)
      if (subject) {
        const res = computeCompletion(subject, wantAmount)
        contributed = res.contributed
        db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(res.completed, subject.id)
      }
    }
    db.prepare(
      `UPDATE task_completions SET completed_amount = ?, contributed = ? WHERE task_id = ? AND date = ?`,
    ).run(wantAmount, contributed, task.id, targetDate)
    return existing.subject_id
  }

  let contributed = 0
  if (wantAmount !== null && wantAmount > 0 && task.subject_id) {
    const subject = findSubject(db, task.subject_id)
    if (subject) {
      const res = computeCompletion(subject, wantAmount)
      contributed = res.contributed
      db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(res.completed, subject.id)
    }
  }
  db.prepare(
    `INSERT INTO task_completions (task_id, date, completed_amount, contributed, subject_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(task.id, targetDate, wantAmount, contributed, task.subject_id)
  return task.subject_id
}

/** 取消每日任务某一天的完成（幂等）：撤销该天贡献并删除记录 */
function uncompleteDailyOn(db: DB, task: TaskRow, targetDate: string): string | null {
  const existing = findCompletion(db, task.id, targetDate)
  if (!existing) return null
  if (existing.contributed > 0 && existing.subject_id) {
    shiftSubject(db, existing.subject_id, -existing.contributed)
  }
  db.prepare(`DELETE FROM task_completions WHERE task_id = ? AND date = ?`).run(task.id, targetDate)
  return existing.subject_id
}

/**
 * 任务核心操作（供 Web API 与 Agent API 共用）：
 * - patchTask：更新/勾选（每日任务按 (task_id, date) 记录完成，普通任务保持原逻辑）；
 * - deleteTask：删除任务并撤销其全部贡献。
 */
export function createTaskOperations(db: DB) {
  const patchTask = db.transaction((id: string, patch: TaskPatch) => {
    const old = findTask(db, id)
    if (!old) throw notFound('任务不存在')
    const today = todayKeyLocal()

    // ================= 每日任务 =================
    if (old.daily === 1) {
      const targetDate = patch.doneDate ?? today
      let affectedSubjectId: string | null = null

      const nextTitle = patch.title !== undefined ? patch.title : old.title
      const nextDate = patch.date !== undefined ? patch.date : old.date
      const nextAmount = patch.amount !== undefined ? patch.amount : old.amount
      const nextSubjectId = patch.subjectId !== undefined ? patch.subjectId : old.subject_id
      if (nextSubjectId && nextSubjectId !== old.subject_id) ensureSubjectExists(db, nextSubjectId)

      if (patch.completed === true) {
        affectedSubjectId = completeDailyOn(db, old, targetDate, patch)
      } else if (patch.completed === false) {
        affectedSubjectId = uncompleteDailyOn(db, old, targetDate)
      }

      // 每日 -> 普通：保留“今天是否完成”为普通任务完成态
      if (patch.daily === false) {
        const compsBefore = listCompletions(db, old.id)
        const todayComp = compsBefore.find((c) => c.date === today)
        db.prepare(
          `UPDATE tasks SET title=?, amount=?, subject_id=?, daily=0, completed=?, done_date=NULL, contributed=?, completed_amount=? WHERE id=?`,
        ).run(
          nextTitle,
          nextAmount,
          nextSubjectId,
          todayComp ? 1 : 0,
          todayComp?.contributed ?? 0,
          todayComp?.completed_amount ?? null,
          id,
        )
        const updated = findTask(db, id)!
        const affected = todayComp?.subject_id ? findSubject(db, todayComp.subject_id) : undefined
        return { task: toTaskDto(updated, []), subject: affected ? toSubjectDto(affected) : null }
      }

      // 更新任务字段 + 兼容字段（done_date 最近完成日期；contributed/completed 取今天视角）
      const comps = listCompletions(db, old.id)
      const last = comps.length > 0 ? comps[comps.length - 1] : null
      const todayComp = comps.find((c) => c.date === today)
      db.prepare(
        `UPDATE tasks SET title=?, date=?, amount=?, subject_id=?, daily=1, done_date=?, contributed=?, completed_amount=?, completed=? WHERE id=?`,
      ).run(
        nextTitle,
        nextDate,
        nextAmount,
        nextSubjectId,
        last?.date ?? null,
        todayComp?.contributed ?? 0,
        todayComp?.completed_amount ?? null,
        todayComp ? 1 : 0,
        id,
      )

      const updated = findTask(db, id)!
      const affected = affectedSubjectId ? findSubject(db, affectedSubjectId) : undefined
      return { task: toTaskDto(updated, comps), subject: affected ? toSubjectDto(affected) : null }
    }

    // ================= 普通任务 =================
    // 普通 -> 每日：撤销普通完成贡献并重置为“今天未完成”
    if (patch.daily === true) {
      if (old.completed === 1 && old.subject_id) {
        const subject = findSubject(db, old.subject_id)
        if (subject) {
          const { completed } = computeRevoke(subject, old.contributed)
          db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(completed, subject.id)
        }
      }
      const nextTitle = patch.title !== undefined ? patch.title : old.title
      const nextAmount = patch.amount !== undefined ? patch.amount : old.amount
      const nextSubjectId = patch.subjectId !== undefined ? patch.subjectId : old.subject_id
      if (nextSubjectId && nextSubjectId !== old.subject_id) ensureSubjectExists(db, nextSubjectId)
      db.prepare(
        `UPDATE tasks SET title=?, amount=?, subject_id=?, daily=1, completed=0, done_date=NULL, contributed=0, completed_amount=NULL WHERE id=?`,
      ).run(nextTitle, nextAmount, nextSubjectId, id)
      const updated = findTask(db, id)!
      const affected = nextSubjectId ? findSubject(db, nextSubjectId) : undefined
      return { task: toTaskDto(updated, []), subject: affected ? toSubjectDto(affected) : null }
    }

    // 普通任务：撤销旧贡献 -> 应用新字段 -> 应用新贡献
    if (old.completed === 1 && old.subject_id) {
      const oldSubject = findSubject(db, old.subject_id)
      if (oldSubject) {
        const { completed } = computeRevoke(oldSubject, old.contributed)
        db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(completed, oldSubject.id)
      }
    }

    let nextCompletedAmount = old.completed_amount
    if (patch.completed !== undefined) {
      if (patch.completed) {
        nextCompletedAmount =
          patch.completedAmount !== undefined
            ? patch.completedAmount
            : (old.completed_amount ?? old.amount)
      } else {
        nextCompletedAmount = null
      }
    } else if (patch.completedAmount !== undefined) {
      nextCompletedAmount = patch.completedAmount
    } else if (
      patch.amount !== undefined &&
      old.completed_amount !== null &&
      old.completed_amount === old.amount
    ) {
      nextCompletedAmount = patch.amount
    }

    const next = {
      title: patch.title !== undefined ? patch.title : old.title,
      date: patch.date !== undefined ? patch.date : old.date,
      completed: patch.completed !== undefined ? (patch.completed ? 1 : 0) : (old.completed as 0 | 1),
      subject_id: patch.subjectId !== undefined ? patch.subjectId : old.subject_id,
      amount: patch.amount !== undefined ? patch.amount : old.amount,
      completed_amount: nextCompletedAmount,
    }
    if (next.subject_id && next.subject_id !== old.subject_id) ensureSubjectExists(db, next.subject_id)

    const newDone = next.completed === 1
    const effectiveAmount = newDone ? (next.completed_amount ?? next.amount) : null
    let contributed = 0
    if (newDone && next.subject_id && effectiveAmount && effectiveAmount > 0) {
      const subject = findSubject(db, next.subject_id)
      if (subject) {
        const res = computeCompletion(subject, effectiveAmount)
        contributed = res.contributed
        db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(res.completed, subject.id)
      }
    }

    db.prepare(
      `UPDATE tasks SET title=?, date=?, completed=?, subject_id=?, amount=?, contributed=?, daily=0, done_date=NULL, completed_amount=? WHERE id=?`,
    ).run(
      next.title,
      next.date,
      next.completed,
      next.subject_id,
      next.amount,
      contributed,
      next.completed_amount,
      id,
    )

    const updated = findTask(db, id)!
    const affected = next.subject_id ? findSubject(db, next.subject_id) : undefined
    return { task: toTaskDto(updated, []), subject: affected ? toSubjectDto(affected) : null }
  })

  const deleteTask = db.transaction((id: string) => {
    const old = findTask(db, id)
    if (!old) throw notFound('任务不存在')

    if (old.daily === 1) {
      // 每日任务：撤销所有历史完成记录的贡献，再删除任务（completions 级联删除）
      const comps = listCompletions(db, old.id)
      for (const c of comps) {
        if (c.contributed > 0 && c.subject_id) shiftSubject(db, c.subject_id, -c.contributed)
      }
    } else if (old.completed === 1 && old.subject_id) {
      const subject = findSubject(db, old.subject_id)
      if (subject) {
        const { completed } = computeRevoke(subject, old.contributed)
        db.prepare(`UPDATE subjects SET completed = ? WHERE id = ?`).run(completed, subject.id)
      }
    }
    db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id)
  })

  return { patchTask, deleteTask }
}

export function registerTaskRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  const { patchTask, deleteTask } = createTaskOperations(db)

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
    if (body.completedAmount !== undefined) {
      patch.completedAmount = optionalNumber(body.completedAmount, '实际完成量')
      if (patch.completedAmount !== null && patch.completedAmount < 0) {
        throw badRequest('实际完成量必须是不小于 0 的数字')
      }
    }
    if (body.doneDate !== undefined) {
      patch.doneDate = requireDateKey(body.doneDate, '完成日期')
    }

    if (patch.amount !== undefined || patch.subjectId !== undefined) {
      const old = findTask(db, id)
      const effectiveSubjectId =
        patch.subjectId !== undefined ? patch.subjectId : (old?.subject_id ?? null)
      if (effectiveSubjectId) ensureSubjectExists(db, effectiveSubjectId)
      if (patch.amount !== undefined) parseAmount(patch.amount, effectiveSubjectId)
    }

    return patchTask(id, patch)
  })

  app.delete('/api/tasks/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    deleteTask(id)
    return { ok: true }
  })
}
