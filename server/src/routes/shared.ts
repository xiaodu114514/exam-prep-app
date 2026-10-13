import type { SiteRow, SubjectRow, TaskRow } from '../db'

/** 本地时区今天（YYYY-MM-DD），与前端日期工具保持一致 */
export function todayKeyLocal(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function toTaskDto(row: TaskRow) {
  // 每日任务：以 done_date 是否为今天决定“今天是否完成”；贡献量同样按天归零
  const isDailyDoneToday = row.daily === 1 && row.done_date === todayKeyLocal()
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    completed: row.daily === 1 ? isDailyDoneToday : row.completed === 1,
    subjectId: row.subject_id,
    amount: row.amount,
    /** 该任务今天对科目的实际贡献量（每日任务昨天完成、今天未勾选时为 0） */
    contributed: row.daily === 1 ? (isDailyDoneToday ? row.contributed : 0) : row.contributed,
    daily: row.daily === 1,
    doneDate: row.done_date,
  }
}

export function toSubjectDto(row: SubjectRow) {
  return { id: row.id, name: row.name, unit: row.unit, total: row.total, completed: row.completed }
}

export function toSiteDto(row: SiteRow) {
  return { id: row.id, name: row.name, url: row.url }
}
