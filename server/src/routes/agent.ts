import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Config } from '../config'
import type { DB, ExamRow, SubjectRow, TaskRow } from '../db'
import { AppError, badRequest, unauthorized } from '../errors'
import { optionalNumber, optionalString, requireDateKey, requireString } from '../validation'
import { createTaskOperations, parseWeekdays, taskDoneOn, taskOccursOn } from './tasks'
import { maskToWeekdays, toTaskDto, todayKeyLocal, weekdaysToMask, WEEKDAYS_ALL } from './shared'

/**
 * Agent 开放接口：供外部 Agent/脚本添加任务、查询完成度。
 * 认证使用独立的 API Key（环境变量 AGENT_API_KEY，可逗号分隔多个），
 * 与登录会话完全独立；未配置 Key 时接口禁用（503）。
 */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

/** 周一起点的一周范围 */
function getWeekRange(ref: string): { start: string; end: string; days: string[] } {
  const [y, m, d] = ref.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(date)
    dd.setDate(dd.getDate() + i)
    days.push(dateKey(dd))
  }
  return { start: days[0], end: days[6], days }
}

export function createAgentAuth(config: Config) {
  const keys = config.agentApiKey
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return async (req: FastifyRequest): Promise<void> => {
    if (keys.length === 0) {
      throw new AppError(503, 'Agent API 未启用（服务器未配置 AGENT_API_KEY）')
    }
    const auth = req.headers.authorization
    const bearer =
      typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    const xKey = typeof req.headers['x-agent-key'] === 'string' ? req.headers['x-agent-key'] : ''
    const provided = bearer || xKey
    if (!provided) throw unauthorized('缺少 Agent API Key')
    const given = Buffer.from(provided)
    const ok = keys.some((k) => {
      const expected = Buffer.from(k)
      return expected.length === given.length && timingSafeEqual(expected, given)
    })
    if (!ok) throw unauthorized('Agent API Key 无效')
  }
}

/** 按天取任务：普通任务（创建日当天）+ 星期任务（创建日不晚于该天且星期匹配） */
function tasksOn(db: DB, day: string): TaskRow[] {
  const all = db.prepare(`SELECT * FROM tasks ORDER BY rowid`).all() as TaskRow[]
  return all.filter((t) => taskOccursOn(t, day))
}

/** 任务在某天的完成态：星期任务查该天 completion 记录，普通任务看 completed */
function isDoneOn(db: DB, t: TaskRow, day: string): boolean {
  return taskDoneOn(db, t, day)
}

function buildStats(db: DB, date: string) {
  const today = todayKeyLocal()
  const week = getWeekRange(date)

  const dayRows = tasksOn(db, date)
  const dayDone = dayRows.filter((t) => isDoneOn(db, t, date))

  const subjects = db
    .prepare(`SELECT id, name, unit, total, completed FROM subjects ORDER BY rowid`)
    .all() as SubjectRow[]

  const bySubject = subjects
    .map((s) => {
      const rows = dayRows.filter((t) => t.subject_id === s.id)
      return {
        subjectId: s.id,
        name: s.name,
        done: rows.filter((t) => isDoneOn(db, t, date)).length,
        total: rows.length,
      }
    })
    .filter((g) => g.total > 0)

  const weekDays = week.days.map((day) => {
    const rows = tasksOn(db, day)
    const done = rows.filter((t) => isDoneOn(db, t, day)).length
    return { date: day, total: rows.length, done }
  })
  const weekTotal = weekDays.reduce((s, d) => s + d.total, 0)
  const weekDone = weekDays.reduce((s, d) => s + d.done, 0)

  const exam = db.prepare(`SELECT id, name, date FROM exam WHERE id = 1`).get() as ExamRow
  const examDaysLeft = exam.date
    ? Math.round(
        (new Date(exam.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) /
          86_400_000,
      )
    : null

  return {
    date,
    today: {
      total: dayRows.length,
      done: dayDone.length,
      rate: dayRows.length ? Math.round((dayDone.length / dayRows.length) * 100) : 0,
      tasks: dayRows.map((t) => {
        const subject = subjects.find((s) => s.id === t.subject_id)
        return {
          id: t.id,
          title: t.title,
          completed: isDoneOn(db, t, date),
          subjectId: t.subject_id,
          subjectName: subject?.name ?? null,
          amount: t.amount,
          daily: t.weekdays === WEEKDAYS_ALL,
          weekdays: maskToWeekdays(t.weekdays),
        }
      }),
      bySubject,
    },
    week: {
      start: week.start,
      end: week.end,
      total: weekTotal,
      done: weekDone,
      rate: weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0,
      days: weekDays,
    },
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit,
      total: s.total,
      completed: s.completed,
      rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    })),
    exam: {
      name: exam.name,
      date: exam.date,
      daysLeft: examDaysLeft,
    },
  }
}

export function registerAgentRoutes(app: FastifyInstance, db: DB, config: Config): void {
  const agentAuth = createAgentAuth(config)

  /** 添加任务 */
  app.post('/api/agent/tasks', { preHandler: agentAuth }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const title = requireString(body.title, '任务名称')
    const date =
      body.date !== undefined && body.date !== null
        ? requireDateKey(body.date)
        : todayKeyLocal()

    const subjectId = optionalString(body.subjectId)
    if (subjectId) {
      const exists = db.prepare(`SELECT id FROM subjects WHERE id = ?`).get(subjectId)
      if (!exists) throw badRequest('所选科目不存在')
    }
    const amount = optionalNumber(body.amount, '背诵量')
    if (amount !== null && amount <= 0) throw badRequest('背诵量必须是大于 0 的数字')
    if (amount !== null && !subjectId) throw badRequest('填写背诵量时必须选择科目')
    // 星期任务（兼容旧 daily 参数：true = 每天）
    const weekdaysRaw = parseWeekdays(body.weekdays)
    const weekdaysMask =
      weekdaysRaw !== undefined
        ? weekdaysToMask(weekdaysRaw)
        : body.daily === true
          ? WEEKDAYS_ALL
          : 0

    const id = randomUUID()
    db.prepare(
      `INSERT INTO tasks (id, title, date, completed, subject_id, amount, contributed, weekdays, done_date)
       VALUES (?, ?, ?, 0, ?, ?, 0, ?, NULL)`,
    ).run(id, title, date, subjectId, amount, weekdaysMask)
    const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow
    return reply.status(201).send({ task: toTaskDto(row) })
  })

  /** 完成度统计 */
  app.get('/api/agent/stats', { preHandler: agentAuth }, async (req) => {
    const query = req.query as { date?: string }
    const date =
      typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
        ? query.date
        : todayKeyLocal()
    return buildStats(db, date)
  })

  /** 任务列表 */
  app.get('/api/agent/tasks', { preHandler: agentAuth }, async (req) => {
    const query = req.query as { date?: string }
    const date =
      typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
        ? query.date
        : todayKeyLocal()
    return {
      date,
      tasks: tasksOn(db, date).map((t) => ({
        id: t.id,
        title: t.title,
        completed: isDoneOn(db, t, date),
        subjectId: t.subject_id,
        amount: t.amount,
        daily: t.weekdays === WEEKDAYS_ALL,
        weekdays: maskToWeekdays(t.weekdays),
      })),
    }
  })

  const { patchTask, deleteTask } = createTaskOperations(db)

  /**
   * 打勾完成 / 取消完成：
   * body: { completed?: boolean（默认 true）, doneDate?: YYYY-MM-DD（每日任务，默认今天）, completedAmount?: number }
   * 每日任务按「任务 + 日期」记录，重复提交幂等。
   */
  app.post('/api/agent/tasks/:id/complete', { preHandler: agentAuth }, async (req) => {
    const { id } = req.params as { id: string }
    const body = (req.body ?? {}) as Record<string, unknown>

    const completed = body.completed === undefined ? true : body.completed
    if (typeof completed !== 'boolean') throw badRequest('completed 必须是布尔值')

    const doneDate =
      body.doneDate !== undefined ? requireDateKey(body.doneDate, '完成日期') : undefined
    const completedAmount =
      body.completedAmount !== undefined
        ? optionalNumber(body.completedAmount, '实际完成量')
        : undefined
    if (completedAmount !== undefined && completedAmount !== null && completedAmount < 0) {
      throw badRequest('实际完成量必须是不小于 0 的数字')
    }

    return patchTask(id, {
      completed,
      ...(doneDate !== undefined ? { doneDate } : {}),
      ...(completedAmount !== undefined && completedAmount !== null ? { completedAmount } : {}),
    })
  })

  /** 删除任务（撤销其全部贡献） */
  app.delete('/api/agent/tasks/:id', { preHandler: agentAuth }, async (req) => {
    const { id } = req.params as { id: string }
    deleteTask(id)
    return { ok: true }
  })
}
