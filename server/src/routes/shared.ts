import type { CompletionRow, SiteRow, SubjectRow, TaskRow } from '../db'

/** 本地时区今天（YYYY-MM-DD），与前端日期工具保持一致 */
export function todayKeyLocal(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 星期集合（1=周一 … 7=周日）-> 位掩码 */
export function weekdaysToMask(days: number[]): number {
  let mask = 0
  for (const d of days) {
    if (Number.isInteger(d) && d >= 1 && d <= 7) mask |= 1 << (d - 1)
  }
  return mask
}

/** 位掩码 -> 星期集合 */
export function maskToWeekdays(mask: number): number[] {
  const days: number[] = []
  for (let i = 0; i < 7; i++) {
    if (mask & (1 << i)) days.push(i + 1)
  }
  return days
}

/** 全选（每天） */
export const WEEKDAYS_ALL = 127

export function toTaskDto(row: TaskRow, completions: CompletionRow[] = []) {
  if (row.weekdays > 0) {
    const today = todayKeyLocal()
    const sorted = [...completions].sort((a, b) => a.date.localeCompare(b.date))
    const todayComp = sorted.find((c) => c.date === today)
    const last = sorted.length > 0 ? sorted[sorted.length - 1] : null
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      // 兼容语义：completed 表示“今天是否完成”（新前端使用 completions 判断任意日期）
      completed: todayComp !== undefined,
      subjectId: row.subject_id,
      amount: row.amount,
      // 兼容语义：今天贡献量（历史日期见 completions）
      contributed: todayComp?.contributed ?? 0,
      completedAmount: todayComp?.completed_amount ?? null,
      /** 兼容旧字段：是否“每天”（全选 7 天） */
      daily: row.weekdays === WEEKDAYS_ALL,
      /** 星期任务：1=周一 … 7=周日；空数组 = 普通任务 */
      weekdays: maskToWeekdays(row.weekdays),
      doneDate: last?.date ?? null,
      completions: sorted.map((c) => ({
        date: c.date,
        completedAmount: c.completed_amount,
        contributed: c.contributed,
      })),
    }
  }

  const completed = row.completed === 1
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    completed,
    subjectId: row.subject_id,
    amount: row.amount,
    contributed: row.contributed,
    completedAmount: completed ? row.completed_amount : null,
    daily: false,
    weekdays: [] as number[],
    doneDate: null,
    completions: [] as Array<{ date: string; completedAmount: number | null; contributed: number }>,
  }
}

export function toSubjectDto(row: SubjectRow) {
  return { id: row.id, name: row.name, unit: row.unit, total: row.total, completed: row.completed }
}

export function toSiteDto(row: SiteRow) {
  return { id: row.id, name: row.name, url: row.url }
}
